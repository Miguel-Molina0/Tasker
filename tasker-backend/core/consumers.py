import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Mensagem, Contratacao
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = None
        self.user = self.scope.get('user')
        if not self.user or self.user.is_anonymous:
            await self.close(code=4401)
            return
        self.contratacao_id = self.scope['url_route']['kwargs']['contratacao_id']
        if not await self.validar_participante():
            await self.close(code=4403)
            return
        self.room_group_name = f'chat_{self.contratacao_id}'
        await self.channel_layer.group_add(self.room_group_name,self.channel_name)
        await self.accept()
    async def disconnect(self, close_code):
        if getattr(self,'room_group_name',None):
            await self.channel_layer.group_discard(self.room_group_name,self.channel_name)
    async def receive(self, text_data=None, bytes_data=None):
        try:
            if not isinstance(text_data,str) or len(text_data) > 20000: raise ValueError()
            payload=json.loads(text_data)
            text=payload.get('mensagem') if isinstance(payload,dict) else None
            if not isinstance(text,str) or not 1 <= len(text.strip()) <= 4000: raise ValueError()
        except (ValueError,TypeError):
            await self.send(text_data=json.dumps({'erro':'Envie uma mensagem de 1 a 4000 caracteres.'}))
            return
        if not await self.validar_participante():
            await self.close(code=4403);return
        message=await self.salvar_mensagem(text.strip())
        if message:
            await self.channel_layer.group_send(self.room_group_name,{'type':'chat_message','id':message.id,
                'mensagem':message.ds_mensagem,'remetente_id':self.user.id,'dt_envio':message.dt_envio.isoformat()})
        else: await self.close(code=4403)
    async def chat_message(self,event):
        await self.send(text_data=json.dumps({key:event[key] for key in ['id','mensagem','remetente_id','dt_envio']}))
    async def status_notification(self,event):
        await self.send(text_data=json.dumps({key:value for key,value in event.items() if key != 'type'}))
    @database_sync_to_async
    def validar_participante(self):
        try:
            c=Contratacao.objects.select_related('fk_id_anuncio').get(pk=self.contratacao_id)
            return self.user.id in [c.fk_id_cliente_id,c.fk_id_anuncio.fk_id_usuario_id]
        except Contratacao.DoesNotExist: return False
    @database_sync_to_async
    def salvar_mensagem(self,text):
        try:
            c=Contratacao.objects.select_related('fk_id_anuncio').get(pk=self.contratacao_id)
            if self.user.id not in [c.fk_id_cliente_id,c.fk_id_anuncio.fk_id_usuario_id]: return None
            return Mensagem.objects.create(fk_id_contratacao=c,remetente=self.user,ds_mensagem=text)
        except Contratacao.DoesNotExist: return None
