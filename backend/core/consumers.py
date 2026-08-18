# core/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Pega o ID da contratação a partir da URL da sala: ws/chat/<id_contratacao>/
        self.contratacao_id = self.scope['url_route']['kwargs']['contratacao_id']
        self.room_group_name = f'chat_{self.contratacao_id}'

        # Entra no grupo do chat
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Sai do grupo ao fechar a conexão
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Recebe a mensagem do cliente (React)
    async def receive(self, text_data):
        data = json.loads(text_data)
        mensagem_texto = data['mensagem']
        user_id = data['user_id']

        # Salva a mensagem no banco de dados em segundo plano
        mensagem_obj = await self.salvar_mensagem(user_id, self.contratacao_id, mensagem_texto)

        # Transmite a mensagem para todos no grupo do chat em tempo real
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'mensagem': mensagem_texto,
                'user_id': user_id,
                'dt_envio': str(mensagem_obj.dt_envio),
            }
        )

    # Envia a mensagem recebida do grupo de volta para o cliente (React)
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'mensagem': event['mensagem'],
            'user_id': event['user_id'],
            'dt_envio': event['dt_envio']
        }))

    @database_sync_to_async
    def salvar_mensagem(self, user_id, contratacao_id, mensagem_texto):
        from .models import Mensagem, Contratacao, Usuario
        contratacao = Contratacao.objects.get(id=contratacao_id)
        user = Usuario.objects.get(id=user_id)
        return Mensagem.objects.create(
            fk_id_contratacao=contratacao,
            remetente=user,
            ds_mensagem=mensagem_texto
        )