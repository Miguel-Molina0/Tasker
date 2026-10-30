from datetime import timedelta
from uuid import uuid4
import requests
from django.conf import settings
from django.utils import timezone

class AsaasError(Exception):
    pass

class AsaasService:
    def __init__(self):
        self.mock = settings.PAYMENTS_MODE == 'mock'
        if settings.PAYMENTS_MODE not in ['mock', 'asaas']:
            raise AsaasError('PAYMENTS_MODE inválido.')
        if not self.mock and not settings.ASAAS_API_KEY:
            raise AsaasError('Configure ASAAS_API_KEY.')
        self.headers = {'access_token': settings.ASAAS_API_KEY, 'Content-Type':'application/json', 'User-Agent':'Tasker-TCC/1.1'}
        self.url = settings.ASAAS_API_URL.rstrip('/')
    def _post(self, route, payload):
        try:
            response = requests.post(self.url+route, json=payload, headers=self.headers, timeout=(5, 20))
            response.raise_for_status()
            result = response.json()
            if not result.get('id'): raise AsaasError('Resposta sem identificador.')
            return result
        except (requests.RequestException, ValueError) as exc:
            raise AsaasError('Falha na comunicação com o Asaas. Confira o painel antes de tentar novamente.') from exc
    def criar_cliente(self, usuario):
        if self.mock: return {'id':'mock_customer_'+str(usuario.id)}
<<<<<<< HEAD
        if not (usuario.nr_cnpj or usuario.nr_cpf): raise AsaasError('Informe CPF/CNPJ antes de gerar uma cobrança.')
        return self._post('/customers', {'name': usuario.username, 'cpfCnpj':usuario.nr_cnpj or usuario.nr_cpf,
=======
<<<<<<< HEAD
        if not usuario.nr_cpf: raise AsaasError('Informe CPF/CNPJ antes de gerar uma cobrança.')
        return self._post('/customers', {'name': usuario.username, 'cpfCnpj':usuario.nr_cpf,
=======
        if not (usuario.nr_cnpj or usuario.nr_cpf): raise AsaasError('Informe CPF/CNPJ antes de gerar uma cobrança.')
        return self._post('/customers', {'name': usuario.username, 'cpfCnpj':usuario.nr_cnpj or usuario.nr_cpf,
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
            'email':usuario.email, 'mobilePhone':usuario.nr_telefone or ''})
    def criar_cobranca(self, cliente_id_asaas, valor, descricao, referencia):
        if self.mock: return {'id':'mock_payment_'+str(uuid4())}
        return self._post('/payments', {'customer':cliente_id_asaas,'billingType':'PIX','value':float(valor),
            'dueDate':str(timezone.localdate()+timedelta(days=3)), 'description':descricao,
            'externalReference':str(referencia)})
    def pix(self, payment_id):
        if self.mock: return {}
        try:
            response = requests.get(self.url+'/payments/'+payment_id+'/pixQrCode', headers=self.headers,timeout=(5,20))
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            raise AsaasError('Cobrança criada; QR Code indisponível. Consulte o painel Asaas.') from exc
    def transferir_para_prestador(self, valor, chave, tipo, referencia):
        if self.mock: return {'id':'mock_transfer_'+str(uuid4())}
        return self._post('/transfers', {'value':float(valor), 'pixAddressKey':chave, 'pixAddressKeyType':tipo,
            'description':'Tasker contratação '+str(referencia)})

    def encerrar_cobranca(self, payment_id, recebido):
        if self.mock: return {'id':payment_id}
        if recebido:
            return self._post('/payments/'+payment_id+'/refund', {})
        try:
            response = requests.delete(self.url+'/payments/'+payment_id,headers=self.headers,timeout=(5,20))
            response.raise_for_status()
            result=response.json()
            if not result.get('deleted'): raise AsaasError('Cancelamento da cobrança não confirmado.')
            return result
        except (requests.RequestException,ValueError) as exc:
            raise AsaasError('Cancelamento não confirmado. Confira o painel antes de tentar novamente.') from exc
