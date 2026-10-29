from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
@database_sync_to_async
def get_user_from_token(token):
    try:
        auth=JWTAuthentication()
        return auth.get_user(auth.get_validated_token(token))
    except (AuthenticationFailed,InvalidToken,TokenError): return AnonymousUser()
class JWTAuthMiddleware:
    def __init__(self,inner): self.inner=inner
    async def __call__(self,scope,receive,send):
        scope=dict(scope)
        token=parse_qs(scope.get('query_string',b'').decode()).get('token',[None])[0]
        # React Native pode enviar o Bearer no cabeçalho; clientes web usam query string.
        header=dict(scope.get('headers',[])).get(b'authorization',b'').decode()
        if header.startswith('Bearer '): token=header[7:]
        scope['user']=await get_user_from_token(token) if token else AnonymousUser()
        return await self.inner(scope,receive,send)

class BrowserOriginMiddleware:
    """Valida Origin em browsers; clientes nativos sem Origin ainda precisam do JWT."""
    def __init__(self, inner):
        from channels.security.websocket import AllowedHostsOriginValidator
        self.inner = inner
        self.browser = AllowedHostsOriginValidator(inner)
    async def __call__(self, scope, receive, send):
        handler = self.browser if b'origin' in dict(scope.get('headers', [])) else self.inner
        return await handler(scope, receive, send)
