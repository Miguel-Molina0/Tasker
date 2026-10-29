import hmac
import logging
from drf_spectacular.utils import extend_schema
from decimal import Decimal, InvalidOperation
from django.conf import settings
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly, IsAdminUser
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from .integration import IntegrationContractMixin, AccountIntegrationMixin, blocked, personal_conflict
from .models import Usuario, Anuncio, Categoria, Servico, Contratacao, Calendario, Pagamento, Avaliacao, Mensagem
from .serializers import (UsuarioSerializer, AnuncioSerializer, CategoriaSerializer, ServicoSerializer,
    ContratacaoSerializer, CalendarioSerializer, PagamentoSerializer, AvaliacaoSerializer, MensagemSerializer, WebhookSerializer)
from .permission import IsOwnerOrReadOnly, IsAuthorOrReadOnly
from .filters import AnuncioFilter
from .pagination import AnuncioPagination
from .services import gerar_cobranca, liberar_pagamento, estornar_pagamento, notificar
from .asaas import AsaasError
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def participante_q(user, prefix=''):
    return Q(**{prefix+'fk_id_cliente':user}) | Q(**{prefix+'fk_id_anuncio__fk_id_usuario':user})

def verificar_conflito(contrato):
    ids = [contrato.fk_id_cliente_id, contrato.fk_id_anuncio.fk_id_usuario_id]
    if personal_conflict(ids, contrato.dt_agendamento, contrato.hr_inicio, contrato.hr_final):
        raise ValidationError('Horário em conflito com compromisso pessoal de uma das partes.')
    if Calendario.objects.filter(fk_id_usuario_id__in=ids, dt_agendamento=contrato.dt_agendamento,
        st_agendamento='CONFIRMADO', hr_inicio__lt=contrato.hr_final, hr_final__gt=contrato.hr_inicio
        ).exclude(fk_id_contratacao=contrato).exists():
        raise ValidationError('O cliente ou prestador já possui compromisso confirmado neste horário.')

class UsuarioViewSet(AccountIntegrationMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = UsuarioSerializer
    queryset = Usuario.objects.all()
    def get_permissions(self):
        return [AllowAny()] if self.action in ['create','recuperar_senha','redefinir_senha'] else [IsAuthenticated()]
    def get_throttles(self):
        if self.action in ['recuperar_senha','redefinir_senha']:
            from .integration import RecoveryThrottle
            return [RecoveryThrottle()]
        return super().get_throttles()
    def get_queryset(self):
        return Usuario.objects.all() if self.request.user.is_staff else Usuario.objects.filter(pk=self.request.user.pk)
    @action(detail=False, methods=['get','put','patch'])
    def me(self, request):
        if request.method == 'GET': return Response(self.get_serializer(request.user).data)
        serializer = self.get_serializer(request.user, data=request.data, partial=request.method=='PATCH')
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class AnuncioViewSet(viewsets.ModelViewSet):
    queryset = Anuncio.objects.select_related('fk_id_usuario','fk_id_categoria').all().order_by('-dt_criacao_anuncio')
    serializer_class = AnuncioSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AnuncioFilter
    pagination_class = AnuncioPagination
    search_fields = ['nm_titulo','nm_descricao']
    ordering_fields = ['vl_preco','dt_criacao_anuncio']
    def perform_create(self, serializer):
        if self.request.user.id_tp_perfil != 'autonomo': raise PermissionDenied('Somente autônomos podem publicar anúncios.')
        serializer.save(fk_id_usuario=self.request.user)
    def perform_destroy(self, instance):
        if instance.contratacoes_anuncio.exists():
            raise ValidationError('Anúncio com histórico de contratação: desative-o em vez de excluir.')
        instance.delete()

class ServicoViewSet(viewsets.ModelViewSet):
    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    def perform_create(self, serializer): serializer.save(fk_id_usuario=self.request.user)

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    def get_permissions(self):
        return [AllowAny()] if self.action in ['list','retrieve'] else [IsAdminUser()]

class CalendarioViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CalendarioSerializer
    queryset = Calendario.objects.all()
    def get_queryset(self):
        return Calendario.objects.filter(fk_id_usuario=self.request.user).order_by('dt_agendamento','hr_inicio')

class PagamentoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PagamentoSerializer
    queryset = Pagamento.objects.all()
    def get_queryset(self):
        qs = Pagamento.objects.select_related('fk_id_contratacao')
        return qs if self.request.user.is_staff else qs.filter(participante_q(self.request.user,'fk_id_contratacao__'))
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def liberar(self, request, pk=None):
        payment = self.get_object()
        try: payment = liberar_pagamento(payment.pk)
        except AsaasError as exc: raise ValidationError(str(exc))
        return Response(self.get_serializer(payment).data)
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def estornar(self, request, pk=None):
        payment = self.get_object()
        try: payment = estornar_pagamento(payment.pk)
        except AsaasError as exc: raise ValidationError(str(exc))
        return Response(self.get_serializer(payment).data)

class ContratacaoViewSet(IntegrationContractMixin, mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ContratacaoSerializer
    queryset = Contratacao.objects.all()
    def get_queryset(self):
        return Contratacao.objects.filter(participante_q(self.request.user)).select_related(
            'fk_id_cliente','fk_id_anuncio__fk_id_usuario').order_by('-dt_criacao')
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if blocked(request.user.pk, serializer.validated_data['fk_id_anuncio'].fk_id_usuario_id): raise PermissionDenied('Há um bloqueio entre estas contas.')
        with transaction.atomic():
            anuncio = serializer.validated_data['fk_id_anuncio']
            # Todos os agendamentos usam os mesmos bloqueios, em ordem fixa (PostgreSQL).
            list(Usuario.objects.select_for_update().filter(pk__in=sorted([request.user.pk, anuncio.fk_id_usuario_id])).order_by('pk'))
            key=serializer.validated_data.get('chave_solicitacao')
            if key:
                existing=Contratacao.objects.filter(fk_id_cliente=request.user,chave_solicitacao=key).first()
                if existing: return Response(self.get_serializer(existing).data, status=200)
            c = serializer.save(fk_id_cliente=request.user)
            verificar_conflito(c)
            for user_id in [c.fk_id_cliente_id, c.fk_id_anuncio.fk_id_usuario_id]:
                Calendario.objects.create(fk_id_usuario_id=user_id, fk_id_contratacao=c,
                    dt_agendamento=c.dt_agendamento, hr_inicio=c.hr_inicio, hr_final=c.hr_final, st_agendamento='PENDENTE')
            Pagamento.objects.create(fk_id_contratacao=c, vl_servico=anuncio.vl_preco, st_pagamento='aguardando')
        payment = gerar_cobranca(c.pk)
        notificar(c.pk,'Nova solicitação de serviço. Compromisso pendente nas duas agendas.')
        data = dict(self.get_serializer(c).data)
        data['pagamento'] = PagamentoSerializer(payment).data
        if payment.erro_integracao:
            data['aviso_pagamento'] = 'Solicitação registrada. Cobrança requer conferência; não repita a contratação.'
        return Response(data, status=status.HTTP_201_CREATED)
    def locked(self):
        # Resolver a visibilidade antes de bloquear; os usuários também serializam a disputa por horários.
        visible = self.get_object()
        list(Usuario.objects.select_for_update().filter(pk__in=sorted([
            visible.fk_id_cliente_id,visible.fk_id_anuncio.fk_id_usuario_id])).order_by('pk'))
        return Contratacao.objects.select_for_update(of=('self',)).select_related('fk_id_anuncio__fk_id_usuario','fk_id_cliente').get(pk=visible.pk)
    @action(detail=True, methods=['patch'])
    def aceitar(self, request, pk=None):
        with transaction.atomic():
            c = self.locked()
            if c.fk_id_anuncio.fk_id_usuario_id != request.user.id: raise PermissionDenied('Somente o prestador pode aceitar.')
            if c.st_status != 'PENDENTE': raise ValidationError('A solicitação deve estar pendente.')
            if not (c.dt_agendamento and c.hr_inicio and c.hr_final): raise ValidationError('Agendamento incompleto.')
            if c.dt_agendamento < timezone.localdate() or (c.dt_agendamento == timezone.localdate() and c.hr_inicio <= timezone.localtime().time().replace(tzinfo=None)):
                raise ValidationError('O horário da solicitação já passou.')
            verificar_conflito(c)
            c.st_status = 'ACEITO'
            c.save(update_fields=['st_status','dt_atualizacao'])
            for user_id in [c.fk_id_cliente_id,c.fk_id_anuncio.fk_id_usuario_id]:
                Calendario.objects.update_or_create(fk_id_usuario_id=user_id,fk_id_contratacao=c,defaults={
                    'dt_agendamento':c.dt_agendamento,'hr_inicio':c.hr_inicio,'hr_final':c.hr_final,'st_agendamento':'CONFIRMADO'})
            transaction.on_commit(lambda: notificar(c.pk,'Contratação aceita. Compromisso confirmado nas duas agendas.'))
        return Response({'status':'Contratação aceita.', 'dados':self.get_serializer(c).data})
    @action(detail=True, methods=['patch'])
    def recusar(self, request, pk=None): return self.encerrar(request, 'RECUSADO')
    @action(detail=True, methods=['patch'])
    def cancelar(self, request, pk=None): return self.encerrar(request, 'CANCELADO')
    def encerrar(self, request, estado):
        with transaction.atomic():
            c = self.locked()
            if estado == 'RECUSADO' and c.fk_id_anuncio.fk_id_usuario_id != request.user.id:
                raise PermissionDenied('Somente o prestador pode recusar.')
            allowed = ['PENDENTE'] if estado == 'RECUSADO' else ['PENDENTE','ACEITO']
            if c.st_status not in allowed: raise ValidationError('Esta contratação não pode ser encerrada assim.')
            c.st_status = estado
            c.save(update_fields=['st_status','dt_atualizacao'])
            Calendario.objects.filter(fk_id_contratacao=c).update(st_agendamento=estado)
            # O histórico financeiro permanece; estorno no gateway real exige conferência administrativa.
            Pagamento.objects.filter(fk_id_contratacao=c).exclude(st_pagamento='liberado').update(st_pagamento='bloqueado')
            transaction.on_commit(lambda: notificar(c.pk,'Contratação '+estado.lower()+'. Horário liberado.'))
        return Response({'status':estado,'dados':self.get_serializer(c).data})
    @action(detail=True, methods=['patch'])
    def concluir(self, request, pk=None):
        with transaction.atomic():
            c = self.locked()
            if c.contestado: raise ValidationError('Serviço contestado; aguarde análise do suporte.')
            if c.st_status not in ['ACEITO','CONCLUIDO']: raise ValidationError('O serviço deve estar aceito.')
            if c.st_status == 'CONCLUIDO': return Response({'status':'Serviço já concluído.','dados':self.get_serializer(c).data})
            if request.user.id == c.fk_id_cliente_id: c.concluido_cliente = True
            else: c.concluido_prestador = True
            final = c.concluido_cliente and c.concluido_prestador
            if final:
                c.st_status = 'CONCLUIDO'
                Calendario.objects.filter(fk_id_contratacao=c).update(st_agendamento='CONCLUIDO')
            c.save()
            transaction.on_commit(lambda: notificar(c.pk,'Serviço concluído.' if final else 'Conclusão confirmada por uma parte. Aguardando a outra.'))
            # Em demonstração apenas, o repasse é simulado automaticamente.
            if final and settings.PAYMENTS_MODE == 'mock':
                payment = Pagamento.objects.filter(fk_id_contratacao=c,st_pagamento='retido',dt_declaracao_pagamento__isnull=False).first()
                if payment: transaction.on_commit(lambda: liberar_pagamento(payment.pk))
        return Response({'status':'Serviço concluído!' if final else 'Confirmação registrada. Aguardando a outra parte.',
            'dados':self.get_serializer(c).data})

class AvaliacaoViewSet(viewsets.ModelViewSet):
    queryset = Avaliacao.objects.all()
    serializer_class = AvaliacaoSerializer
    permission_classes = [IsAuthenticatedOrReadOnly,IsAuthorOrReadOnly]
    def get_queryset(self):
        qs = Avaliacao.objects.select_related('avaliador','avaliado').order_by('-dt_criacao')
        usuario_id = self.request.query_params.get('usuario_id')
        if usuario_id:
            if not usuario_id.isdigit(): raise ValidationError('usuario_id inválido.')
            qs = qs.filter(avaliado_id=usuario_id)
        return qs
    def perform_create(self, serializer):
        user = self.request.user
        c = serializer.validated_data['fk_id_contratacao']
        avaliado = c.fk_id_anuncio.fk_id_usuario if user.id == c.fk_id_cliente_id else c.fk_id_cliente
        try:
            with transaction.atomic(): serializer.save(avaliador=user,avaliado=avaliado)
        except IntegrityError: raise ValidationError('Você já avaliou esta contratação.')

class MensagemViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = MensagemSerializer
    queryset = Mensagem.objects.all()
    def get_queryset(self):
        qs = Mensagem.objects.filter(participante_q(self.request.user,'fk_id_contratacao__')).order_by('dt_envio')
        contrato = self.request.query_params.get('contratacao')
        if contrato:
            if not contrato.isdigit(): raise ValidationError('Contratação inválida.')
            qs = qs.filter(fk_id_contratacao_id=contrato)
        return qs
    def perform_create(self, serializer):
        c = serializer.validated_data['fk_id_contratacao']
        if not Contratacao.objects.filter(participante_q(self.request.user),pk=c.pk).exists():
            raise PermissionDenied('Você não participa desta contratação.')
        message = serializer.save(remetente=self.request.user)
        try:
            async_to_sync(get_channel_layer().group_send)(f'chat_{c.pk}',{'type':'chat_message','id':message.id,
                'mensagem':message.ds_mensagem,'remetente_id':message.remetente_id,'dt_envio':message.dt_envio.isoformat()})
        except Exception:
            logging.getLogger(__name__).exception('Mensagem salva, mas transmissão indisponível.')

class AsaasWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    @extend_schema(request=WebhookSerializer, responses={200:dict,400:dict,403:dict,503:dict})
    def post(self, request):
        token = settings.ASAAS_WEBHOOK_TOKEN
        if not token or not hmac.compare_digest(request.headers.get('asaas-access-token',''),token):
            raise PermissionDenied('Webhook não autorizado.')
        serializer = WebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.validated_data['event']
        if isinstance(event, str) and event.startswith('TRANSFER_'):
            transfer = request.data.get('transfer')
            if not isinstance(transfer,dict) or not transfer.get('id'): raise ValidationError('Transferência inválida.')
            with transaction.atomic():
                p = Pagamento.objects.select_for_update().filter(asaas_transfer_id=transfer['id']).first()
                if not p: return Response({'status':'transferência desconhecida'},status=503)
                if event == 'TRANSFER_DONE' and p.st_pagamento == 'processando': p.st_pagamento='liberado'
                elif event in ['TRANSFER_FAILED','TRANSFER_CANCELLED'] and p.st_pagamento == 'processando':
                    p.st_pagamento='bloqueado'
                    p.erro_integracao='Repasse não concluído; requer conferência no gateway.'
                p.save()
            return Response({'status':'received'})
        payment = request.data.get('payment')
        if not isinstance(payment,dict) or not payment.get('id'): raise ValidationError('Pagamento inválido.')
        with transaction.atomic():
            p = Pagamento.objects.select_for_update().select_related('fk_id_contratacao').filter(asaas_payment_id=payment['id']).first()
            if not p: return Response({'status':'pagamento desconhecido'},status=503)
            if event == 'PAYMENT_RECEIVED':
                try:
                    if Decimal(str(payment.get('value'))) != p.vl_servico: raise ValidationError('Valor divergente.')
                except (InvalidOperation,TypeError): raise ValidationError('Valor inválido.')
                # CONFIRMED não representa necessariamente saldo liberado para Pix.
                if p.st_pagamento == 'aguardando' and p.fk_id_contratacao.st_status not in ['CANCELADO','RECUSADO']:
                    p.st_pagamento='retido'
                if not p.dt_declaracao_pagamento: p.dt_declaracao_pagamento=timezone.now()
            elif event in ['PAYMENT_REFUNDED','PAYMENT_DELETED','PAYMENT_CHARGEBACK_REQUESTED']:
                p.st_pagamento='bloqueado'
                if event == 'PAYMENT_REFUNDED' and not p.dt_estorno: p.dt_estorno=timezone.now()
            p.save()
        return Response({'status':'received'})
