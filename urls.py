from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, MensagemViewSet, UsuarioViewSet, AnuncioViewSet, ServicoViewSet, ContratacaoViewSet, PagamentoViewSet, CalendarioViewSet, ChatViewSet, AvaliacaoViewSet
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'anuncios', AnuncioViewSet)
router.register(r'servicos', ServicoViewSet)
router.register(r'contratacoes', ContratacaoViewSet)
router.register(r'categorias', CategoriaViewSet)
router.register(r'pagamentos', PagamentoViewSet)
router.register(r'calendarios', CalendarioViewSet)
router.register(r'chats', ChatViewSet)
router.register(r'avaliacoes', AvaliacaoViewSet)
router.register(r'mensagens', MensagemViewSet, basename='mensagem')

urlpatterns = [
    path('', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)