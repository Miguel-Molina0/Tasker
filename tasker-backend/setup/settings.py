import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'
SECRET_KEY = os.getenv('SECRET_KEY', 'local-demo-only-change-before-deployment-50-characters')
if not DEBUG and SECRET_KEY.startswith('local-demo'):
    raise RuntimeError('Configure SECRET_KEY antes de executar em produção.')
ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',') if host.strip()]
if os.getenv('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
CSRF_TRUSTED_ORIGINS = [s.strip() for s in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if s.strip()]
INSTALLED_APPS = ['daphne', 'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'channels',
    'rest_framework', 'corsheaders', 'django_filters', 'drf_spectacular', 'core.apps.CoreConfig']
MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware', 'django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
CORS_ALLOWED_ORIGINS = [s for s in os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006').split(',') if s]
ROOT_URLCONF = 'setup.urls'
TEMPLATES = [{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[], 'APP_DIRS':True,
    'OPTIONS':{'context_processors':['django.template.context_processors.debug', 'django.template.context_processors.request',
    'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'setup.wsgi.application'
ASGI_APPLICATION = 'setup.asgi.application'
# Redis compartilha mensagens de WebSocket entre os processos Daphne.
REDIS_URL = os.getenv('REDIS_URL', '').strip()
if REDIS_URL:
    CHANNEL_LAYERS = {'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL], 'prefix': 'tasker:channels'},
    }}
else:
    if not DEBUG:
        raise RuntimeError('REDIS_URL é obrigatório em produção para WebSockets.')
    CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.getenv('SQLITE_PATH', str(BASE_DIR/'db.sqlite3'))}}
if os.getenv('DB_NAME'):
    DATABASES = {'default': {'ENGINE':'django.db.backends.postgresql','NAME':os.environ['DB_NAME'],
        'USER':os.getenv('DB_USER','postgres'),'PASSWORD':os.getenv('DB_PASSWORD',''),
        'HOST':os.getenv('DB_HOST','localhost'),'PORT':os.getenv('DB_PORT','5432'),
        'OPTIONS': {'sslmode': os.environ['PGSSLMODE']} if os.getenv('PGSSLMODE') else {}}}
AUTH_PASSWORD_VALIDATORS = [{'NAME':'django.contrib.auth.password_validation.'+name} for name in
    ['UserAttributeSimilarityValidator','MinimumLengthValidator','CommonPasswordValidator','NumericPasswordValidator']]
AUTH_USER_MODEL = 'core.Usuario'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
# Storage privado: URLs assinadas temporárias para as fotos de perfil.
# As credenciais Cloudinary pertencem somente ao backend.
CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '').strip()
CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '').strip()
CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '').strip()
cloudinary_values = (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
if any(cloudinary_values) and not all(cloudinary_values):
    raise RuntimeError('Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET juntos.')
if all(cloudinary_values):
    STORAGES['default'] = {'BACKEND': 'core.cloudinary_storage.CloudinaryMediaStorage'}
elif not DEBUG:
    raise RuntimeError('Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET em produção para persistir imagens.')
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.getenv('MEDIA_ROOT', str(BASE_DIR/'media')))
REST_FRAMEWORK = {'DEFAULT_SCHEMA_CLASS':'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES':['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated']}
SIMPLE_JWT = {'ACCESS_TOKEN_LIFETIME':timedelta(hours=1), 'REFRESH_TOKEN_LIFETIME':timedelta(days=7)}
SPECTACULAR_SETTINGS = {'TITLE':'Tasker API','VERSION':'1.1.0','SERVE_INCLUDE_SCHEMA':False}
PAYMENTS_MODE = os.getenv('PAYMENTS_MODE', 'mock')
ASAAS_API_URL = os.getenv('ASAAS_API_URL', 'https://api-sandbox.asaas.com/v3')
ASAAS_API_KEY = os.getenv('ASAAS_API_KEY','')
ASAAS_WEBHOOK_TOKEN = os.getenv('ASAAS_WEBHOOK_TOKEN','')
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND','django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST','localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT','25'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER','')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD','')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS','false').lower() == 'true'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL','tasker@localhost')
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL') or REDIS_URL or 'memory://'
CELERY_TASK_ALWAYS_EAGER = not bool(os.getenv('CELERY_BROKER_URL') or REDIS_URL)
CELERY_TASK_EAGER_PROPAGATES = False
CELERY_TASK_IGNORE_RESULT = True
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

PASSWORD_RESET_URL = os.getenv('PASSWORD_RESET_URL','http://localhost:8081/recuperar-senha')
SIMPLE_JWT['CHECK_REVOKE_TOKEN'] = True

REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']={'recovery':'5/min'}
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
