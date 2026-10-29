import json
import logging
import os
import firebase_admin
from firebase_admin import credentials
from django.apps import AppConfig

logger = logging.getLogger(__name__)

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        raw = os.getenv('FIREBASE_CREDENTIALS_JSON', '').strip()
        path = os.getenv('FIREBASE_CREDENTIALS', '').strip()
        if not raw and not path:
            return  # Desenvolvimento local sem notificações FCM.
        try:
            firebase_admin.get_app()
        except ValueError:
            if raw:
                cred = credentials.Certificate(json.loads(raw))
            else:
                cred = credentials.Certificate(path)
            options = {}
            bucket = os.getenv('FIREBASE_STORAGE_BUCKET', '').replace('gs://', '').strip()
            if bucket:
                options['storageBucket'] = bucket
            firebase_admin.initialize_app(cred, options)
