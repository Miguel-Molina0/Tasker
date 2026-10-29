import logging
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Usuario, Pagamento, Contratacao, Notificacao
from .asaas import AsaasService, AsaasError
from .tasks import enviar_email_notificacao, enviar_push_fcm
logger = logging.getLogger(__name__)

def notificar(contrato_id, texto):
    # Falhas de entrega não revertem a operação de negócio já confirmada.
    try:
        c = Contratacao.objects.select_related('fk_id_cliente','fk_id_anuncio__fk_id_usuario').get(pk=contrato_id)
        async_to_sync(get_channel_layer().group_send)(f'chat_{c.id}', {'type':'status_notification',
            'mensagem':texto,'st_status':c.st_status,'concluido_cliente':c.concluido_cliente,
            'concluido_prestador':c.concluido_prestador})
        for u in [c.fk_id_cliente, c.fk_id_anuncio.fk_id_usuario]:
            Notificacao.objects.create(usuario=u,texto=texto[:300],rota='detalhe-contratacao',alvo=str(c.pk))
            if u.email: enviar_email_notificacao.delay(u.email, 'Atualização Tasker', texto)
            if u.fcm_token: enviar_push_fcm.delay(u.fcm_token, 'Atualização Tasker', texto, {'contratacao_id':str(c.id)})
    except Exception:
        logger.exception('Falha ao enviar notificação da contratação %s', contrato_id)

def gerar_cobranca(contrato_id):
    c = Contratacao.objects.select_related('fk_id_cliente','fk_id_anuncio').get(pk=contrato_id)
    payment = Pagamento.objects.get(fk_id_contratacao=c)
    try:
        gateway = AsaasService()
        # Serializa a criação do cliente externo para requisições concorrentes.
        with transaction.atomic():
            cliente = Usuario.objects.select_for_update().get(pk=c.fk_id_cliente_id)
            if not cliente.asaas_customer_id or gateway.mock != cliente.asaas_customer_id.startswith('mock_'):
                cliente.asaas_customer_id = gateway.criar_cliente(cliente)['id']
                cliente.save(update_fields=['asaas_customer_id'])
        result = gateway.criar_cobranca(cliente.asaas_customer_id, payment.vl_servico,
            f'Contratação #{c.id} - {c.fk_id_anuncio.nm_titulo}', c.id)
        payment.asaas_payment_id = result['id']
        # O modo mock simula o recebimento; no Asaas só o webhook confirma.
        if gateway.mock:
            payment.st_pagamento = 'retido'
            payment.dt_declaracao_pagamento = timezone.now()
        payment.save()
        pix = gateway.pix(result['id'])
        payment.pix_qr_code = pix.get('encodedImage')
        payment.pix_copia_cola = pix.get('payload')
        payment.save(update_fields=['pix_qr_code','pix_copia_cola'])
    except AsaasError as exc:
        payment.erro_integracao = str(exc)
        payment.save(update_fields=['erro_integracao'])
        logger.warning('Cobrança %s requer conferência no painel Asaas.', payment.pk)
    return payment

def liberar_pagamento(payment_id):
    # A tentativa é persistida ANTES do HTTP. Resultado ambíguo não é reenviado automaticamente.
    with transaction.atomic():
        p = Pagamento.objects.select_for_update(of=('self',)).select_related('fk_id_contratacao__fk_id_anuncio__fk_id_usuario').get(pk=payment_id)
        c = p.fk_id_contratacao
        if c.contestado: raise AsaasError('Serviço contestado.')
        if c.st_status != 'CONCLUIDO' or not (c.concluido_cliente and c.concluido_prestador):
            raise AsaasError('As duas partes precisam confirmar a conclusão.')
        if not p.dt_declaracao_pagamento or p.st_pagamento != 'retido' or p.repasse_tentado:
            raise AsaasError('Pagamento indisponível para repasse ou tentativa já registrada.')
        if not p.asaas_payment_id or (p.asaas_payment_id.startswith('mock_') != (settings.PAYMENTS_MODE == 'mock')):
            raise AsaasError('O pagamento pertence a outro ambiente. Confira a configuração.')
        prestador = c.fk_id_anuncio.fk_id_usuario
        if settings.PAYMENTS_MODE != 'mock' and not prestador.chave_pix:
            raise AsaasError('Prestador sem chave Pix.')
        p.st_pagamento = 'processando'
        p.repasse_tentado = True
        p.save(update_fields=['st_pagamento','repasse_tentado'])
    try:
        result = AsaasService().transferir_para_prestador(p.vl_servico, prestador.chave_pix, prestador.tipo_chave_pix, c.id)
        p.asaas_transfer_id = result['id']
        # No gateway real, criar uma transferência não comprova sua efetivação.
        if settings.PAYMENTS_MODE == 'mock': p.st_pagamento = 'liberado'
        p.save(update_fields=['asaas_transfer_id','st_pagamento'])
    except AsaasError as exc:
        p.erro_integracao = str(exc)
        p.save(update_fields=['erro_integracao'])
        raise
    return p

def estornar_pagamento(payment_id):
    with transaction.atomic():
        p=Pagamento.objects.select_for_update(of=('self',)).select_related('fk_id_contratacao').get(pk=payment_id)
        if p.fk_id_contratacao.st_status not in ['CANCELADO','RECUSADO']:
            raise AsaasError('A contratação precisa estar cancelada ou recusada.')
        if p.repasse_tentado or p.estorno_tentado or not p.asaas_payment_id:
            raise AsaasError('Conciliação necessária: repasse/tentativa já registrado ou cobrança sem ID.')
        if p.asaas_payment_id.startswith('mock_') != (settings.PAYMENTS_MODE=='mock'):
            raise AsaasError('O pagamento pertence a outro ambiente.')
        p.estorno_tentado=True
        p.st_pagamento='bloqueado'
        p.save(update_fields=['estorno_tentado','st_pagamento'])
    try:
        AsaasService().encerrar_cobranca(p.asaas_payment_id, bool(p.dt_declaracao_pagamento))
        if settings.PAYMENTS_MODE=='mock' and p.dt_declaracao_pagamento:
            p.dt_estorno=timezone.now()
            p.save(update_fields=['dt_estorno'])
    except AsaasError as exc:
        p.erro_integracao=str(exc)
        p.save(update_fields=['erro_integracao'])
        raise
    return p
