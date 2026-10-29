import os
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE','setup.settings')
django_asgi_app=get_asgi_application()
from channels.routing import ProtocolTypeRouter, URLRouter
from core.middleware import JWTAuthMiddleware, BrowserOriginMiddleware
from core.routing import websocket_urlpatterns
application=ProtocolTypeRouter({'http':django_asgi_app,
    'websocket':BrowserOriginMiddleware(JWTAuthMiddleware(URLRouter(websocket_urlpatterns)))})
