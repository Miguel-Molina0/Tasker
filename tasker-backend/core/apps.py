<<<<<<< HEAD
import json
import logging
=======
<<<<<<< HEAD
=======
import json
import logging
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
import os
import firebase_admin
from firebase_admin import credentials
from django.apps import AppConfig
<<<<<<< HEAD
=======
<<<<<<< HEAD
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    def ready(self):
        path = os.getenv('FIREBASE_CREDENTIALS')
        if path and os.path.isfile(path):
            try: firebase_admin.get_app()
            except ValueError: firebase_admin.initialize_app(credentials.Certificate(path))
=======
>>>>>>> 5e662bf (backend atualizado)

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
            # Firebase é usado apenas para notificações FCM; fotos usam Cloudinary.
            firebase_admin.initialize_app(cred)
<<<<<<< HEAD
=======
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
