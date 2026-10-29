from datetime import datetime, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import (Usuario, Contratacao, Calendario, CompromissoPessoal, Favorito, Bloqueio, Protocolo, Notificacao)
from .serializers import PerfilPublicoSerializer


def blocked(a,b):
    return Bloqueio.objects.filter(Q(usuario_id=a,bloqueado_id=b)|Q(usuario_id=b,bloqueado_id=a)).exists()

def valid_schedule(date, time, duration):
    if not 30<=duration<=480 or (time.hour*60+time.minute)+duration>=1440:
        raise ValidationError('Duração deve ser de 30 a 480 minutos e terminar no mesmo dia.')
    if timezone.make_aware(datetime.combine(date,time)) <= timezone.now():
        raise ValidationError('Escolha uma data e horário futuros.')

def personal_conflict(users,date,time,end,except_id=None):
    for e in CompromissoPessoal.objects.filter(usuario_id__in=users,data=date).exclude(pk=except_id):
        finish=(datetime.combine(e.data,e.hora)+timedelta(minutes=e.duracao)).time()
        if time < finish and e.hora < end: return True
    return False

class PerfilViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Usuario.objects.filter(is_active=True)
    serializer_class = PerfilPublicoSerializer
    permission_classes = [AllowAny]

class FavoritoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorito
        fields = ['id','anuncio']
class FavoritoViewSet(mixins.ListModelMixin,mixins.CreateModelMixin,mixins.DestroyModelMixin,viewsets.GenericViewSet):
    queryset = Favorito.objects.all()
    serializer_class = FavoritoSerializer
    def get_queryset(self): return Favorito.objects.filter(usuario=self.request.user)
    def perform_create(self,s):
        if not s.validated_data['anuncio'].st_anuncio: raise ValidationError('Anúncio inativo.')
        # Repetir o POST de favorito não duplica o registro.
        obj,_=Favorito.objects.get_or_create(usuario=self.request.user,anuncio=s.validated_data['anuncio'])
        s.instance=obj

class BloqueioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bloqueio
        fields = ['id','bloqueado']
    def validate_bloqueado(self,value):
        if value==self.context['request'].user or not value.is_active: raise serializers.ValidationError('Perfil inválido.')
        return value
class BloqueioViewSet(mixins.ListModelMixin,mixins.CreateModelMixin,mixins.DestroyModelMixin,viewsets.GenericViewSet):
    queryset = Bloqueio.objects.all()
    serializer_class = BloqueioSerializer
    def get_queryset(self): return Bloqueio.objects.filter(usuario=self.request.user)
    def perform_create(self,s):
        obj,_=Bloqueio.objects.get_or_create(usuario=self.request.user,bloqueado=s.validated_data['bloqueado'])
        s.instance=obj

class CompromissoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompromissoPessoal
        fields = ['id','titulo','data','hora','duracao','observacoes']
    def validate(self,data):
        old=self.instance
        date=data.get('data',getattr(old,'data',None))
        time=data.get('hora',getattr(old,'hora',None))
        duration=data.get('duracao',getattr(old,'duracao',60))
        valid_schedule(date,time,duration)
        return data
class CompromissoViewSet(viewsets.ModelViewSet):
    queryset = CompromissoPessoal.objects.all()
    serializer_class = CompromissoSerializer
    def get_queryset(self): return CompromissoPessoal.objects.filter(usuario=self.request.user).order_by('data','hora')
    def save_locked(self,s):
        with transaction.atomic():
            Usuario.objects.select_for_update().get(pk=self.request.user.pk)
            old=s.instance
            date=s.validated_data.get('data',getattr(old,'data',None))
            time=s.validated_data.get('hora',getattr(old,'hora',None))
            duration=s.validated_data.get('duracao',getattr(old,'duracao',60))
            end=(datetime.combine(date,time)+timedelta(minutes=duration)).time()
            if Calendario.objects.filter(fk_id_usuario=self.request.user,dt_agendamento=date,st_agendamento='CONFIRMADO',hr_inicio__lt=end,hr_final__gt=time).exists() or personal_conflict([self.request.user.id],date,time,end,getattr(old,'pk',None)):
                raise ValidationError('Horário em conflito com sua agenda.')
            s.save(usuario=self.request.user)
    def perform_create(self,s): self.save_locked(s)
    def perform_update(self,s): self.save_locked(s)

class ProtocoloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Protocolo
        fields = ['id','assunto','texto','alvo','criado','estado','resposta']
        read_only_fields = ['criado','estado','resposta']
    def validate_texto(self,v):
        if len(v.strip())<5: raise serializers.ValidationError('Descreva a solicitação com ao menos 5 caracteres.')
        return v.strip()
class ProtocoloViewSet(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,viewsets.GenericViewSet):
    queryset = Protocolo.objects.all()
    serializer_class = ProtocoloSerializer
    def get_queryset(self): return Protocolo.objects.filter(usuario=self.request.user).order_by('-criado')
    def perform_create(self,s): s.save(usuario=self.request.user)

class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        fields = ['id','texto','rota','alvo','lida','criado']
class NotificacaoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notificacao.objects.all()
    serializer_class = NotificacaoSerializer
    def get_queryset(self): return Notificacao.objects.filter(usuario=self.request.user).order_by('-criado')
    @action(detail=False,methods=['post'])
    def ler(self,request):
        qs=self.get_queryset()
        pk=request.data.get('id')
        if pk:
            try: qs=qs.filter(pk=int(pk))
            except (ValueError,TypeError): raise ValidationError('ID inválido.')
        qs.update(lida=True)
        return Response({'status':'ok'})

class ConfigSerializer(serializers.Serializer):
    payments_mode=serializers.ChoiceField(choices=["mock","asaas"])

class ConfigViewSet(viewsets.GenericViewSet):
    serializer_class=ConfigSerializer
    permission_classes = [AllowAny]
    def list(self,request):
        from django.conf import settings
        return Response({'payments_mode':settings.PAYMENTS_MODE})

class ScheduleProposalSerializer(serializers.Serializer):
    data=serializers.DateField()
    hora=serializers.TimeField()
class ScheduleAnswerSerializer(serializers.Serializer):
    aceitar=serializers.BooleanField()

class IntegrationContractMixin:
    @action(detail=True,methods=['patch'])
    def reagendar(self,request,pk=None):
        s=ScheduleProposalSerializer(data=request.data);s.is_valid(raise_exception=True)
        date,time=s.validated_data['data'],s.validated_data['hora']
        with transaction.atomic():
            c=self.locked()
            if c.contestado or c.st_status not in ['PENDENTE','ACEITO'] or c.proposta_reagendamento:
                raise ValidationError('Reagendamento indisponível.')
            if not all([c.dt_agendamento,c.hr_inicio,c.hr_final]): raise ValidationError('Agendamento incompleto.')
            duration=int((datetime.combine(c.dt_agendamento,c.hr_final)-datetime.combine(c.dt_agendamento,c.hr_inicio)).total_seconds()/60)
            valid_schedule(date,time,duration)
            c.proposta_reagendamento={'date':str(date),'time':time.strftime('%H:%M'),'by':str(request.user.pk)}
            c.save(update_fields=['proposta_reagendamento','dt_atualizacao'])
            from .services import notificar
            transaction.on_commit(lambda:notificar(c.pk,'Novo horário proposto. Aguarda resposta da outra parte.'))
        return Response(self.get_serializer(c).data)
    @action(detail=True,methods=['patch'],url_path='responder-reagendamento')
    def responder_reagendamento(self,request,pk=None):
        s=ScheduleAnswerSerializer(data=request.data);s.is_valid(raise_exception=True)
        with transaction.atomic():
            c=self.locked();proposal=c.proposta_reagendamento
            if c.contestado or c.st_status not in ['PENDENTE','ACEITO'] or not proposal: raise ValidationError('Sem proposta pendente.')
            if proposal['by']==str(request.user.pk): raise PermissionDenied('A outra parte precisa responder.')
            if s.validated_data['aceitar']:
                duration=int((datetime.combine(c.dt_agendamento,c.hr_final)-datetime.combine(c.dt_agendamento,c.hr_inicio)).total_seconds()/60)
                date=datetime.strptime(proposal['date'],'%Y-%m-%d').date();time=datetime.strptime(proposal['time'],'%H:%M').time()
                valid_schedule(date,time,duration)
                c.dt_agendamento=date;c.hr_inicio=time;c.hr_final=(datetime.combine(date,time)+timedelta(minutes=duration)).time()
                from .views import verificar_conflito
                verificar_conflito(c)
                Calendario.objects.filter(fk_id_contratacao=c).update(dt_agendamento=date,hr_inicio=time,hr_final=c.hr_final)
            c.proposta_reagendamento=None;c.save()
            from .services import notificar
            transaction.on_commit(lambda:notificar(c.pk,'Resposta ao reagendamento registrada.'))
        return Response(self.get_serializer(c).data)
    @action(detail=True,methods=['patch'])
    def contestar(self,request,pk=None):
        reason=request.data.get('motivo','')
        if not isinstance(reason,str) or len(reason.strip())<5: raise ValidationError('Descreva o motivo.')
        with transaction.atomic():
            c=self.locked()
            if c.st_status!='ACEITO': raise ValidationError('Só serviços aceitos podem ser contestados.')
            c.contestado=True;c.motivo_contestacao=reason[:2000];c.save()
            from .models import Pagamento
            Pagamento.objects.filter(fk_id_contratacao=c).update(st_pagamento='bloqueado')
            Protocolo.objects.create(usuario=request.user,assunto=f'Contestação #{c.pk}',texto=reason[:4000])
            from .services import notificar
            transaction.on_commit(lambda:notificar(c.pk,'Contratação contestada. Pagamento bloqueado para análise.'))
        return Response(self.get_serializer(c).data)

class AccountIntegrationMixin:
    @action(detail=False, methods=['post'],url_path='alterar-senha')
    def alterar_senha(self,request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as PasswordError
        current=request.data.get('senha_atual','');password=request.data.get('nova_senha','')
        if not isinstance(current,str) or not request.user.check_password(current): raise ValidationError('A senha atual não confere.')
        if not isinstance(password,str): raise ValidationError('Senha inválida.')
        try: validate_password(password,request.user)
        except PasswordError as exc: raise ValidationError(exc.messages)
        request.user.set_password(password);request.user.save(update_fields=['password'])
        return Response({'status':'Senha alterada.'})
    @action(detail=False, methods=['delete'],url_path='excluir-conta')
    def excluir_conta(self,request):
        from uuid import uuid4
        with transaction.atomic():
            user=Usuario.objects.select_for_update().get(pk=request.user.pk)
            if Contratacao.objects.filter(Q(fk_id_cliente=user)|Q(fk_id_anuncio__fk_id_usuario=user)).exclude(st_status__in=['CONCLUIDO','CANCELADO','RECUSADO']).exists():
                raise ValidationError('Finalize ou cancele os serviços ativos antes de excluir a conta.')
            # Histórico financeiro é preservado; conta fica inativa e sem perfil público.
            user.is_active=False;user.username='removido_'+uuid4().hex;user.email='';user.first_name='';user.last_name=''
            user.nr_cpf=None;user.nr_cnpj=None;user.nr_telefone=None;user.nm_cidade='';user.ds_biografia='';user.dt_nascimento=None;user.tp_foto=None
            user.fcm_token=None;user.chave_pix=None;user.set_unusable_password();user.save()
            from .models import Anuncio
            Anuncio.objects.filter(fk_id_usuario=user).update(st_anuncio=False)
        return Response(status=204)

# Public recovery operations never reveal whether an email exists.
class RecoveryRequestSerializer(serializers.Serializer):
    email=serializers.EmailField()
class RecoveryConfirmSerializer(serializers.Serializer):
    uid=serializers.CharField()
    token=serializers.CharField()
    password=serializers.CharField()

@action(detail=False,methods=['post'],url_path='recuperar-senha',permission_classes=[AllowAny])
def recuperar_senha(self,request):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from django.conf import settings
    from .tasks import enviar_email_notificacao
    s=RecoveryRequestSerializer(data=request.data);s.is_valid(raise_exception=True)
    user=Usuario.objects.filter(email__iexact=s.validated_data['email'],is_active=True).first()
    if user:
        uid=urlsafe_base64_encode(force_bytes(user.pk));token=default_token_generator.make_token(user)
        url=settings.PASSWORD_RESET_URL
        separator='&' if '?' in url else '?'
        # Do not expose reset tokens in API responses.
        enviar_email_notificacao.delay(user.email,'Recuperação Tasker',f'{url}{separator}uid={uid}&token={token}')
    return Response({'status':'Se o email estiver cadastrado, você receberá instruções para recuperar o acesso.'})

@action(detail=False,methods=['post'],url_path='redefinir-senha',permission_classes=[AllowAny])
def redefinir_senha(self,request):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_decode
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as PasswordError
    s=RecoveryConfirmSerializer(data=request.data);s.is_valid(raise_exception=True)
    try: pk=int(urlsafe_base64_decode(s.validated_data['uid']).decode())
    except (ValueError,TypeError,UnicodeError): raise ValidationError('Link inválido ou expirado.')
    with transaction.atomic():
        user=Usuario.objects.select_for_update().filter(pk=pk,is_active=True).first()
        if not user or not default_token_generator.check_token(user,s.validated_data['token']): raise ValidationError('Link inválido ou expirado.')
        try: validate_password(s.validated_data['password'],user)
        except PasswordError as exc: raise ValidationError(exc.messages)
        user.set_password(s.validated_data['password']);user.save(update_fields=['password'])
    return Response({'status':'Senha redefinida. Entre novamente.'})
AccountIntegrationMixin.recuperar_senha=recuperar_senha
AccountIntegrationMixin.redefinir_senha=redefinir_senha

from rest_framework.throttling import SimpleRateThrottle
class RecoveryThrottle(SimpleRateThrottle):
    scope='recovery'
    def get_cache_key(self,request,view):
        return self.cache_format % {'scope':self.scope,'ident':self.get_ident(request)}
