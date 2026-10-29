"""Armazenamento de fotos no bucket do Firebase Storage (Google Cloud Storage)."""
import json
import os
from django.conf import settings
from storages.backends.gcloud import GoogleCloudStorage
from google.oauth2 import service_account


def firebase_credentials():
    raw = os.getenv('FIREBASE_CREDENTIALS_JSON', '').strip()
    if raw:
        # Nunca registrar esse JSON: contém uma chave privada.
        return service_account.Credentials.from_service_account_info(json.loads(raw))
    path = os.getenv('FIREBASE_CREDENTIALS', '').strip()
    if path:
        return service_account.Credentials.from_service_account_file(path)
    # Usa ADC se o servidor possuir identidade Google configurada.
    return None


class FirebaseMediaStorage(GoogleCloudStorage):
    """Bucket privado com acesso por links assinados (1 hora)."""
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('bucket_name', settings.FIREBASE_STORAGE_BUCKET)
        kwargs.setdefault('credentials', firebase_credentials())
        kwargs.setdefault('querystring_auth', True)
        kwargs.setdefault('expiration', 3600)
        kwargs.setdefault('default_acl', None)
        kwargs.setdefault('file_overwrite', False)
        super().__init__(*args, **kwargs)
