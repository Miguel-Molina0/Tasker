import logging
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import firebase_admin
from firebase_admin import messaging
logger = logging.getLogger(__name__)
@shared_task
def enviar_email_notificacao(email_destino, assunto, mensagem):
    send_mail(assunto, mensagem, settings.DEFAULT_FROM_EMAIL, [email_destino], fail_silently=False)
@shared_task
def enviar_push_fcm(fcm_token, titulo, corpo, dados_extras=None):
    if not fcm_token: return
    try: firebase_admin.get_app()
    except ValueError:
        logger.warning('Firebase não configurado; push não enviado.')
        return
    messaging.send(messaging.Message(notification=messaging.Notification(title=titulo,body=corpo),
        token=fcm_token,data=dados_extras or {}))
# Compatibilidade com importações antigas.
enviar_email_noticacao = enviar_email_notificacao
