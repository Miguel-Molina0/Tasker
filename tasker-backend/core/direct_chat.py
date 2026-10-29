from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Usuario, Mensagem, Contratacao
from .serializers import MensagemSerializer
from .integration import blocked
from .consumers import ChatConsumer
from channels.db import database_sync_to_async


def message_peer(m):
    if m.destinatario_id: return m.destinatario_id
    if m.fk_id_contratacao_id:
        c=m.fk_id_contratacao
        return c.fk_id_anuncio.fk_id_usuario_id if m.remetente_id==c.fk_id_cliente_id else c.fk_id_cliente_id

def dm_group(a,b): return f'dm_{min(int(a),int(b))}_{max(int(a),int(b))}'

class DirectMessageViewSet(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,mixins.DestroyModelMixin,viewsets.GenericViewSet):
    serializer_class=MensagemSerializer
    queryset=Mensagem.objects.all()
    def get_queryset(self):
        u=self.request.user
        qs=Mensagem.objects.filter(Q(remetente=u)|Q(destinatario=u)|Q(fk_id_contratacao__fk_id_cliente=u)|Q(fk_id_contratacao__fk_id_anuncio__fk_id_usuario=u)).select_related('fk_id_contratacao__fk_id_anuncio').order_by('dt_envio')
        c=self.request.query_params.get('contratacao')
        if c:
            if not c.isdigit(): raise ValidationError('Contratação inválida.')
            qs=qs.filter(fk_id_contratacao_id=c)
        return qs.distinct()
    def perform_create(self,s):
        user=self.request.user
        c=s.validated_data.get('fk_id_contratacao')
        peer=s.validated_data.get('destinatario')
        if c:
            ids=[c.fk_id_cliente_id,c.fk_id_anuncio.fk_id_usuario_id]
            if user.pk not in ids: raise PermissionDenied('Você não participa desta contratação.')
            expected=next(pk for pk in ids if pk!=user.pk)
            if peer and peer.pk!=expected: raise ValidationError('Destinatário não participa da contratação.')
            peer=Usuario.objects.get(pk=expected)
        if not peer or not peer.is_active or peer==user: raise ValidationError('Escolha outra pessoa para conversar.')
        if blocked(user.pk,peer.pk): raise PermissionDenied('Mensagens bloqueadas entre estas contas.')
        m=s.save(remetente=user,destinatario=peer)
        try:
            async_to_sync(get_channel_layer().group_send)(dm_group(user.pk,peer.pk),{'type':'chat_message','id':m.pk,'mensagem':m.ds_mensagem,'remetente_id':user.pk,'destinatario_id':peer.pk,'dt_envio':m.dt_envio.isoformat()})
        except Exception:
            import logging
            logging.getLogger(__name__).exception('Mensagem salva; transmissão indisponível.')
    def perform_destroy(self,instance):
        if instance.remetente_id!=self.request.user.pk: raise PermissionDenied('Apenas o remetente pode excluir.')
        instance.delete()
    @action(detail=False,methods=['post'])
    def ler(self,request):
        peer=request.data.get('remetente')
        try: peer=int(peer)
        except (ValueError,TypeError): raise ValidationError('Remetente inválido.')
        if peer==request.user.pk: raise ValidationError('Escolha o remetente da outra conta.')
        self.get_queryset().filter(remetente_id=peer).filter(Q(destinatario=request.user)|Q(destinatario__isnull=True)).update(lida=True)
        return Response({'status':'ok'})

class DirectChatConsumer(ChatConsumer):
    async def connect(self):
        self.room_group_name=None
        self.user=self.scope.get('user')
        if not self.user or self.user.is_anonymous:
            await self.close(code=4401);return
        self.peer_id=int(self.scope['url_route']['kwargs']['usuario_id'])
        if not await self.validar_participante():
            await self.close(code=4403);return
        self.room_group_name=dm_group(self.user.pk,self.peer_id)
        await self.channel_layer.group_add(self.room_group_name,self.channel_name)
        await self.accept()
    @database_sync_to_async
    def validar_participante(self):
        return Usuario.objects.filter(pk=self.user.pk,is_active=True).exists() and self.peer_id!=self.user.pk and Usuario.objects.filter(pk=self.peer_id,is_active=True).exists() and not blocked(self.user.pk,self.peer_id)
    @database_sync_to_async
    def salvar_mensagem(self,text):
        if blocked(self.user.pk,self.peer_id) or not Usuario.objects.filter(pk=self.peer_id,is_active=True).exists(): return None
        return Mensagem.objects.create(remetente=self.user,destinatario_id=self.peer_id,ds_mensagem=text)
