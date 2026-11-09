from django.contrib import admin
from core import painel
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView, 
    SpectacularRedocView, 
    SpectacularSwaggerView
)

# Importações corrigidas e separadas:
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        attrs = dict(attrs)
        login = attrs.get('username','')
        if '@' in login:
            from core.models import Usuario
            candidate = Usuario.objects.filter(email__iexact=login.strip(),is_active=True).first()
            if candidate: attrs['username'] = candidate.username
        data = super().validate(attrs)
        data['id_tp_perfil'] = self.user.id_tp_perfil
        data['username'] = self.user.username
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    path('painel/login/', painel.painel_login, name='painel_login'),
    path('painel/sair/', painel.painel_sair, name='painel_sair'),
    path('painel/', painel.painel_inicio, name='painel_inicio'),
    path('painel/usuarios/', painel.painel_usuarios, name='painel_usuarios'),
    path('painel/usuarios/<int:pk>/status/', painel.painel_usuario_status, name='painel_usuario_status'),
    path('painel/anuncios/', painel.painel_anuncios, name='painel_anuncios'),
    path('painel/anuncios/<int:pk>/status/', painel.painel_anuncio_status, name='painel_anuncio_status'),
    path('painel/contratacoes/', painel.painel_contratacoes, name='painel_contratacoes'),
    path('painel/pagamentos/', painel.painel_pagamentos, name='painel_pagamentos'),
    path('painel/suporte/', painel.painel_suporte, name='painel_suporte'),
    path('painel/suporte/<int:pk>/responder/', painel.painel_protocolo_responder, name='painel_protocolo_responder'),
    path('painel/relatorios/', painel.painel_relatorios, name='painel_relatorios'),
    path('painel/exportar/', painel.painel_exportar, name='painel_exportar'),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
from django.conf import settings
from django.conf.urls.static import static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
