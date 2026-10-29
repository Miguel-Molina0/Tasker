from django.urls import path, include
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from .views import (
    AsaasWebhookView, CategoriaViewSet, MensagemViewSet, UsuarioViewSet, AnuncioViewSet, 
    ServicoViewSet, ContratacaoViewSet, PagamentoViewSet, CalendarioViewSet,  AvaliacaoViewSet
)
from .integration import PerfilViewSet, FavoritoViewSet, BloqueioViewSet, CompromissoViewSet, ProtocoloViewSet, NotificacaoViewSet, ConfigViewSet
from .direct_chat import DirectMessageViewSet
router = DefaultRouter()
for name,view in [('perfis',PerfilViewSet),('favoritos',FavoritoViewSet),('bloqueios',BloqueioViewSet),('compromissos',CompromissoViewSet),('suporte',ProtocoloViewSet),('notificacoes',NotificacaoViewSet),('config',ConfigViewSet)]:
    router.register(name,view,basename=name)
router.register(r'usuarios', UsuarioViewSet)
router.register(r'anuncios', AnuncioViewSet)
router.register(r'avaliacao', AvaliacaoViewSet, basename='avaliacao')
router.register(r'servicos', ServicoViewSet)
router.register(r'contratacoes', ContratacaoViewSet, basename='contratacao')
router.register(r'categorias', CategoriaViewSet)
router.register(r'pagamentos', PagamentoViewSet)
router.register(r'calendarios', CalendarioViewSet)
router.register(r'mensagens', DirectMessageViewSet, basename='mensagem')

urlpatterns = [
    path('webhooks/asaas/', AsaasWebhookView.as_view(), name='asaas-webhook'),
    path('', include(router.urls)),
]
