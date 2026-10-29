from datetime import timedelta
from unittest.mock import patch, Mock
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken
from channels.testing import WebsocketCommunicator
from asgiref.sync import async_to_sync
from .models import Usuario, Anuncio, Categoria, Contratacao, Calendario, Pagamento, Mensagem
from .services import liberar_pagamento
from .asaas import AsaasError

class BackendTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.u=Usuario.objects.create_user(username='cliente',password='StrongPass!2026')
        self.p=Usuario.objects.create_user(username='prestador',password='StrongPass!2026',id_tp_perfil='autonomo')
        self.other=Usuario.objects.create_user(username='outro',password='StrongPass!2026')
        cat=Categoria.objects.create(nm_categoria='Limpeza')
        self.a=Anuncio.objects.create(nm_titulo='Limpeza residencial',nm_descricao='Limpeza completa',vl_preco=100,
            nm_area_atendimento='SP',nm_disponibilidade='Manhã',fk_id_usuario=self.p,fk_id_categoria=cat,nr_latitude=-23.55,nr_longitude=-46.63)
        self.data={'fk_id_anuncio':self.a.pk,'dt_agendamento':str(timezone.localdate()+timedelta(days=2)),'hr_inicio':'10:00','hr_final':'11:00'}
        self.client.force_authenticate(self.u)
    def contratar(self):
        r=self.client.post('/api/contratacoes/',self.data,format='json')
        self.assertEqual(r.status_code,201,r.data)
        return Contratacao.objects.get(pk=r.data['id'])
    def action(self,c,name,user=None):
        self.client.force_authenticate(user or self.p)
        with self.captureOnCommitCallbacks(execute=True), patch('core.views.notificar'):
            return self.client.patch(f'/api/contratacoes/{c.pk}/{name}/',{},format='json')
    def test_cadastro_senha_segura_hash(self):
        self.client.force_authenticate(None)
        for password,code in [('123',400),('GoodPassword#762',201)]:
            r=self.client.post('/api/usuarios/',{'username':'novo','password':password},format='json')
            self.assertEqual(r.status_code,code,r.data)
        self.assertNotIn('password',r.data)
        self.assertTrue(Usuario.objects.get(username='novo').check_password('GoodPassword#762'))
    def test_atualizar_senha(self):
        r=self.client.patch('/api/usuarios/me/',{'password':'OtherStrong!2026'},format='json')
        self.assertEqual(r.status_code,200,r.data);self.u.refresh_from_db()
        self.assertTrue(self.u.check_password('OtherStrong!2026'))
    def test_anonimo_sem_dados_privados(self):
        self.client.force_authenticate(None)
        for path in ['/api/calendarios/','/api/pagamentos/','/api/usuarios/me/',f'/api/usuarios/{self.u.pk}/']:
            self.assertEqual(self.client.get(path).status_code,401,path)
    def test_usuario_nao_acessa_outro(self):
        self.assertEqual(self.client.get(f'/api/usuarios/{self.other.pk}/').status_code,404)
        self.assertEqual(self.client.delete(f'/api/usuarios/{self.u.pk}/').status_code,405)
    def test_solicitacao_agendas_e_pagamento_mock(self):
        c=self.contratar()
        self.assertEqual(Calendario.objects.filter(fk_id_contratacao=c,st_agendamento='PENDENTE').count(),2)
        self.assertSetEqual(set(Calendario.objects.filter(fk_id_contratacao=c).values_list('fk_id_usuario_id',flat=True)),{self.u.pk,self.p.pk})
        self.assertEqual(Pagamento.objects.get(fk_id_contratacao=c).st_pagamento,'retido')
        self.assertEqual(self.client.get(f'/api/contratacoes/{c.pk}/').data['prestador_id'],self.p.pk)
    def test_proprio_servico(self):
        self.client.force_authenticate(self.p)
        self.assertEqual(self.client.post('/api/contratacoes/',self.data,format='json').status_code,400)
    def test_agendamento_invalido(self):
        for payload in [dict(self.data,hr_final='09:00'),dict(self.data,dt_agendamento=str(timezone.localdate()-timedelta(days=1))),
            dict(self.data,hr_inicio=None),{k:v for k,v in self.data.items() if k!='dt_agendamento'}]:
            self.assertEqual(self.client.post('/api/contratacoes/',payload,format='json').status_code,400)
    def test_aceitacao_permissao_e_sem_duplicar(self):
        c=self.contratar()
        self.assertEqual(self.action(c,'aceitar',self.u).status_code,403)
        self.assertEqual(self.action(c,'aceitar').status_code,200)
        self.assertEqual(self.action(c,'aceitar').status_code,400)
        self.assertEqual(Calendario.objects.filter(fk_id_contratacao=c,st_agendamento='CONFIRMADO').count(),2)
    def test_conflito_na_aceitacao(self):
        c1=self.contratar();c2=self.contratar()
        self.assertEqual(self.action(c1,'aceitar').status_code,200)
        self.assertEqual(self.action(c2,'aceitar').status_code,400)
        c2.refresh_from_db();self.assertEqual(c2.st_status,'PENDENTE')
    def test_conflito_nova_solicitacao_rollback(self):
        c=self.contratar();self.action(c,'aceitar');self.client.force_authenticate(self.u)
        self.assertEqual(self.client.post('/api/contratacoes/',self.data,format='json').status_code,400)
        self.assertEqual(Contratacao.objects.count(),1)
    def test_conclusao_duas_partes_repasse_unico(self):
        c=self.contratar();self.action(c,'aceitar')
        self.assertEqual(self.action(c,'concluir',self.u).status_code,200)
        payment=Pagamento.objects.get(fk_id_contratacao=c)
        self.assertEqual(payment.st_pagamento,'retido');self.assertFalse(payment.repasse_tentado)
        self.assertEqual(self.action(c,'concluir').status_code,200)
        c.refresh_from_db();payment.refresh_from_db()
        self.assertEqual(c.st_status,'CONCLUIDO');self.assertEqual(payment.st_pagamento,'liberado')
        transfer=payment.asaas_transfer_id
        self.action(c,'concluir');payment.refresh_from_db();self.assertEqual(payment.asaas_transfer_id,transfer)
    def test_cancelar_historico_e_liberar_horario(self):
        c=self.contratar();self.action(c,'aceitar')
        self.assertEqual(self.action(c,'cancelar',self.u).status_code,200)
        self.assertEqual(Calendario.objects.filter(fk_id_contratacao=c,st_agendamento='CANCELADO').count(),2)
        self.assertEqual(Pagamento.objects.get(fk_id_contratacao=c).st_pagamento,'bloqueado')
        self.client.force_authenticate(self.u);self.contratar()
    def test_recusar_permissao(self):
        c=self.contratar()
        self.assertEqual(self.action(c,'recusar',self.u).status_code,403)
        self.assertEqual(self.action(c,'recusar').status_code,200)
        self.assertEqual(Calendario.objects.filter(fk_id_contratacao=c,st_agendamento='RECUSADO').count(),2)
    def test_dados_privados_e_mutacoes_bloqueadas(self):
        c=self.contratar();payment=Pagamento.objects.get(fk_id_contratacao=c)
        self.client.force_authenticate(self.other)
        for path in ['/api/calendarios/','/api/pagamentos/','/api/mensagens/']: self.assertEqual(self.client.get(path).data,[])
        self.assertEqual(self.client.get(f'/api/contratacoes/{c.pk}/').status_code,404)
        self.assertEqual(self.client.get(f'/api/pagamentos/{payment.pk}/').status_code,404)
        self.client.force_authenticate(self.u)
        self.assertEqual(self.client.patch(f'/api/contratacoes/{c.pk}/',self.data,format='json').status_code,405)
        self.assertEqual(self.client.patch(f'/api/pagamentos/{payment.pk}/',{},format='json').status_code,405)
        self.assertEqual(self.client.post('/api/calendarios/',{},format='json').status_code,405)
    def test_anuncio_protegido(self):
        self.assertEqual(self.client.patch(f'/api/anuncios/{self.a.pk}/',{'vl_preco':'1'},format='json').status_code,403)
        self.client.force_authenticate(self.p)
        self.assertEqual(self.client.patch(f'/api/anuncios/{self.a.pk}/',{'fk_id_usuario':self.other.pk},format='json').status_code,200)
        self.a.refresh_from_db();self.assertEqual(self.a.fk_id_usuario,self.p)
        self.client.force_authenticate(self.u);self.contratar();self.client.force_authenticate(self.p)
        self.assertEqual(self.client.delete(f'/api/anuncios/{self.a.pk}/').status_code,400)
    def test_busca_distancia(self):
        self.client.force_authenticate(None)
        r=self.client.get('/api/anuncios/',{'search':'completa'})
        self.assertEqual(r.status_code,200);self.assertEqual(r.data['count'],1)
        r=self.client.get('/api/anuncios/',{'latitude':'-23.55','longitude':'-46.63','raio_km':'10'})
        self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['count'],1)
        self.assertIn('distancia_km',r.data['results'][0])
        self.assertEqual(self.client.get('/api/anuncios/',{'latitude':'100','longitude':'0'}).status_code,400)
    def test_avaliacao_autor_e_duplicacao(self):
        c=self.contratar();self.action(c,'aceitar');self.action(c,'concluir',self.u);self.action(c,'concluir')
        self.client.force_authenticate(self.u)
        payload={'fk_id_contratacao':c.pk,'nr_nota':5,'ds_comentario':'Ótimo'}
        r=self.client.post('/api/avaliacao/',payload,format='json');self.assertEqual(r.status_code,201,r.data)
        self.assertEqual(self.client.post('/api/avaliacao/',payload,format='json').status_code,400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(f"/api/avaliacao/{r.data['id']}/",{'nr_nota':1},format='json').status_code,403)
        self.assertEqual(self.client.post('/api/avaliacao/',payload,format='json').status_code,400)
    def test_mensagem_remetente_e_participante(self):
        c=self.contratar()
        r=self.client.post('/api/mensagens/',{'fk_id_contratacao':c.pk,'ds_mensagem':'Olá','remetente':self.other.pk},format='json')
        self.assertEqual(r.status_code,201,r.data);self.assertEqual(r.data['remetente'],self.u.pk)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post('/api/mensagens/',{'fk_id_contratacao':c.pk,'ds_mensagem':'Olá'},format='json').status_code,403)
    @override_settings(ASAAS_WEBHOOK_TOKEN='test-secret')
    def test_webhook_auth_valor_idempotencia(self):
        c=self.contratar();payment=Pagamento.objects.get(fk_id_contratacao=c)
        payment.st_pagamento='aguardando';payment.dt_declaracao_pagamento=None;payment.save()
        self.client.force_authenticate(None)
        payload={'event':'PAYMENT_RECEIVED','payment':{'id':payment.asaas_payment_id,'value':100}}
        self.assertEqual(self.client.post('/api/webhooks/asaas/',payload,format='json').status_code,403)
        headers={'HTTP_ASAAS_ACCESS_TOKEN':'test-secret'}
        bad={'event':'PAYMENT_RECEIVED','payment':{'id':payment.asaas_payment_id,'value':1}}
        self.assertEqual(self.client.post('/api/webhooks/asaas/',bad,format='json',**headers).status_code,400)
        self.assertEqual(self.client.post('/api/webhooks/asaas/',payload,format='json',**headers).status_code,200)
        payment.refresh_from_db();stamp=payment.dt_declaracao_pagamento
        self.client.post('/api/webhooks/asaas/',payload,format='json',**headers)
        payment.refresh_from_db();self.assertEqual(payment.dt_declaracao_pagamento,stamp);self.assertEqual(payment.st_pagamento,'retido')
    @override_settings(ASAAS_WEBHOOK_TOKEN='test-secret')
    def test_confirmed_nao_libera_e_estorno_bloqueia(self):
        c=self.contratar();payment=Pagamento.objects.get(fk_id_contratacao=c)
        payment.st_pagamento='aguardando';payment.dt_declaracao_pagamento=None;payment.save()
        for event,expected in [('PAYMENT_CONFIRMED','aguardando'),('PAYMENT_REFUNDED','bloqueado'),('PAYMENT_RECEIVED','bloqueado')]:
            self.client.post('/api/webhooks/asaas/',{'event':event,'payment':{'id':payment.asaas_payment_id,'value':100}},
                format='json',HTTP_ASAAS_ACCESS_TOKEN='test-secret')
            payment.refresh_from_db();self.assertEqual(payment.st_pagamento,expected)
    @override_settings(PAYMENTS_MODE='asaas',ASAAS_API_KEY='test-key')
    def test_gateway_falha_preserva_solicitacao(self):
        import requests
        self.u.nr_cpf='12345678900';self.u.save()
        with patch('core.asaas.requests.post',side_effect=requests.Timeout()): c=self.contratar()
        payment=Pagamento.objects.get(fk_id_contratacao=c)
        self.assertEqual(payment.st_pagamento,'aguardando');self.assertIsNone(payment.asaas_payment_id)
        self.assertTrue(payment.erro_integracao);self.assertEqual(Calendario.objects.filter(fk_id_contratacao=c).count(),2)
    def test_repasse_exige_conclusao_e_recebimento(self):
        c=self.contratar();payment=Pagamento.objects.get(fk_id_contratacao=c)
        with self.assertRaises(AsaasError): liberar_pagamento(payment.pk)
        c.st_status='CONCLUIDO';c.concluido_cliente=c.concluido_prestador=True;c.save()
        payment.dt_declaracao_pagamento=None;payment.save()
        with self.assertRaises(AsaasError): liberar_pagamento(payment.pk)
    @override_settings(PAYMENTS_MODE='asaas',ASAAS_API_KEY='test-key')
    def test_repasse_ambiguo_nao_reenvia(self):
        import requests
        c=Contratacao.objects.create(fk_id_cliente=self.u,fk_id_anuncio=self.a,st_status='CONCLUIDO',concluido_cliente=True,concluido_prestador=True)
        self.p.chave_pix='test-key';self.p.save()
        payment=Pagamento.objects.create(fk_id_contratacao=c,vl_servico=100,st_pagamento='retido',dt_declaracao_pagamento=timezone.now(),asaas_payment_id='pay_test')
        with patch('core.asaas.requests.post',side_effect=requests.Timeout()) as post:
            with self.assertRaises(AsaasError): liberar_pagamento(payment.pk)
            with self.assertRaises(AsaasError): liberar_pagamento(payment.pk)
            self.assertEqual(post.call_count,1)
        payment.refresh_from_db();self.assertEqual(payment.st_pagamento,'processando');self.assertTrue(payment.repasse_tentado)

    @override_settings(PAYMENTS_MODE='asaas',ASAAS_API_KEY='test-key',ASAAS_WEBHOOK_TOKEN='test-secret')
    def test_gateway_fluxo_recebimento_repasse_webhook(self):
        self.u.nr_cpf='12345678900';self.u.save()
        self.p.chave_pix='some-pix-key';self.p.save()
        customer=Mock();customer.json.return_value={'id':'cus_test'}
        charge=Mock();charge.json.return_value={'id':'pay_test'}
        qr=Mock();qr.json.return_value={'encodedImage':'image-test','payload':'pix-test'}
        with patch('core.asaas.requests.post',side_effect=[customer,charge]),patch('core.asaas.requests.get',return_value=qr):
            c=self.contratar()
        payment=Pagamento.objects.get(fk_id_contratacao=c)
        self.assertEqual(payment.st_pagamento,'aguardando');self.assertEqual(payment.pix_copia_cola,'pix-test')
        self.action(c,'aceitar');self.action(c,'concluir',self.u);self.action(c,'concluir')
        payment.refresh_from_db();self.assertFalse(payment.repasse_tentado)
        self.client.post('/api/webhooks/asaas/',{'event':'PAYMENT_RECEIVED','payment':{'id':'pay_test','value':100}},
            format='json',HTTP_ASAAS_ACCESS_TOKEN='test-secret')
        self.client.force_authenticate(self.u)
        self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/liberar/').status_code,403)
        self.u.is_staff=True;self.u.save()
        transfer=Mock();transfer.json.return_value={'id':'tra_test'}
        with patch('core.asaas.requests.post',return_value=transfer) as post:
            r=self.client.post(f'/api/pagamentos/{payment.pk}/liberar/')
            self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['st_pagamento'],'processando')
            self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/liberar/').status_code,400)
            self.assertEqual(post.call_count,1)
        for _ in range(2):
            self.assertEqual(self.client.post('/api/webhooks/asaas/',{'event':'TRANSFER_DONE','transfer':{'id':'tra_test'}},
                format='json',HTTP_ASAAS_ACCESS_TOKEN='test-secret').status_code,200)
        payment.refresh_from_db();self.assertEqual(payment.st_pagamento,'liberado')

    def test_estorno_mock_apenas_admin_e_uma_tentativa(self):
        c=self.contratar();self.action(c,'cancelar',self.u)
        payment=Pagamento.objects.get(fk_id_contratacao=c)
        self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/estornar/').status_code,403)
        self.u.is_staff=True;self.u.save()
        self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/estornar/').status_code,200)
        payment.refresh_from_db();self.assertIsNotNone(payment.dt_estorno)
        self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/estornar/').status_code,400)

    @override_settings(PAYMENTS_MODE='asaas',ASAAS_API_KEY='test-key',ASAAS_WEBHOOK_TOKEN='test-secret')
    def test_estorno_live_aguarda_webhook(self):
        c=Contratacao.objects.create(fk_id_cliente=self.u,fk_id_anuncio=self.a,st_status='CANCELADO')
        payment=Pagamento.objects.create(fk_id_contratacao=c,vl_servico=100,st_pagamento='bloqueado',asaas_payment_id='pay_refund',dt_declaracao_pagamento=timezone.now())
        self.u.is_staff=True;self.u.save()
        response=Mock();response.json.return_value={'id':'pay_refund'}
        with patch('core.asaas.requests.post',return_value=response) as post:
            self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/estornar/').status_code,200)
            self.assertTrue(post.call_args.args[0].endswith('/refund'))
        payment.refresh_from_db();self.assertIsNone(payment.dt_estorno)
        self.client.post('/api/webhooks/asaas/',{'event':'PAYMENT_REFUNDED','payment':{'id':'pay_refund'}},
            format='json',HTTP_ASAAS_ACCESS_TOKEN='test-secret')
        payment.refresh_from_db();self.assertIsNotNone(payment.dt_estorno)

    @override_settings(PAYMENTS_MODE='asaas',ASAAS_API_KEY='test-key')
    def test_cancelamento_cobranca_nao_paga(self):
        c=Contratacao.objects.create(fk_id_cliente=self.u,fk_id_anuncio=self.a,st_status='RECUSADO')
        payment=Pagamento.objects.create(fk_id_contratacao=c,vl_servico=100,st_pagamento='bloqueado',asaas_payment_id='pay_unpaid')
        self.u.is_staff=True;self.u.save()
        response=Mock();response.json.return_value={'deleted':True}
        with patch('core.asaas.requests.delete',return_value=response) as delete:
            self.assertEqual(self.client.post(f'/api/pagamentos/{payment.pk}/estornar/').status_code,200)
            self.assertEqual(delete.call_count,1)

    @override_settings(ASAAS_WEBHOOK_TOKEN='test-secret')
    def test_webhook_payload_malformado(self):
        for data in [[],{}, {'event':'PAYMENT_RECEIVED','payment':None}]:
            self.assertEqual(self.client.post('/api/webhooks/asaas/',data,format='json',HTTP_ASAAS_ACCESS_TOKEN='test-secret').status_code,400)

class WebsocketTests(TransactionTestCase):
    def setUp(self):
        self.u=Usuario.objects.create_user(username='cliente-ws')
        self.p=Usuario.objects.create_user(username='prestador-ws')
        self.other=Usuario.objects.create_user(username='intruso-ws')
        cat=Categoria.objects.create(nm_categoria='Teste')
        a=Anuncio.objects.create(nm_titulo='Teste',vl_preco=10,fk_id_usuario=self.p,fk_id_categoria=cat)
        self.c=Contratacao.objects.create(fk_id_cliente=self.u,fk_id_anuncio=a)
        self.token=str(AccessToken.for_user(self.u));self.other_token=str(AccessToken.for_user(self.other))
    def test_jwt_remetente_status_malformado(self):
        from setup.asgi import application
        from channels.layers import get_channel_layer
        async def scenario():
            comm=WebsocketCommunicator(application,f'/ws/chat/{self.c.pk}/?token={self.token}')
            connected,_=await comm.connect();self.assertTrue(connected)
            await comm.send_json_to({'mensagem':'Olá','remetente_id':self.other.pk})
            r=await comm.receive_json_from();self.assertEqual(r['remetente_id'],self.u.pk)
            await comm.send_to(text_data='bad-json');self.assertIn('erro',await comm.receive_json_from())
            await get_channel_layer().group_send(f'chat_{self.c.pk}',{'type':'status_notification','st_status':'ACEITO','mensagem':'Aceito'})
            self.assertEqual((await comm.receive_json_from())['st_status'],'ACEITO')
            await comm.disconnect()
        async_to_sync(scenario)();self.assertEqual(Mensagem.objects.get().remetente_id,self.u.pk)
    def test_recusa_anonimo_intruso_origem(self):
        from setup.asgi import application
        async def scenario():
            for suffix,headers in [('',[]),(f'?token={self.other_token}',[]),('?token=invalid',[]),
                (f'?token={self.token}',[(b'origin',b'https://evil.example')])]:
                comm=WebsocketCommunicator(application,f'/ws/chat/{self.c.pk}/'+suffix,headers=headers)
                connected,_=await comm.connect();self.assertFalse(connected);await comm.disconnect()
        async_to_sync(scenario)()
