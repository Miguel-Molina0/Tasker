from django.urls import re_path
from . import consumers
from .direct_chat import DirectChatConsumer

websocket_urlpatterns = [
    re_path(r'ws/conversa/(?P<usuario_id>\d+)/$', DirectChatConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<contratacao_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
]