from datetime import timedelta
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken
from .models import Usuario, Categoria, Anuncio, Contratacao, Calendario, Favorito, Bloqueio, Mensagem, Protocolo
from channels.testing import WebsocketCommunicator
from asgiref.sync import async_to_sync

class IntegratedEndpointsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client=APIClient()
        self.u=Usuario.objects.create_user(username='customer',email='customer@test.com',password='Testing!8345')
        self.p=Usuario.objects.create_user(username='professional',password='Testing!8345',id_tp_perfil='autonomo')
        self.other=Usuario.objects.create_user(username='other',password='Testing!8345')
        cat=Categoria.objects.create(nm_categoria='Design')
        self.ad=Anuncio.objects.create(nm_titulo='Design',nm_descricao='Design',vl_preco=100,fk_id_usuario=self.p,fk_id_categoria=cat,dias_atendimento=[0,1,2,3,4,5,6])
        self.day=str(timezone.localdate()+timedelta(days=4))
        self.data={'fk_id_anuncio':self.ad.pk,'dt_agendamento':self.day,'hr_inicio':'10:00','hr_final':'11:00','ds_solicitacao':'Cinco telas','nm_endereco':'Remoto','chave_solicitacao':'test-same-request'}
        self.client.force_authenticate(self.u)
    def contract(self):
        r=self.client.post('/api/contratacoes/',self.data,format='json')
        self.assertEqual(r.status_code,201,r.data)
        return r.data['id']
    def test_public_profile_no_private_fields(self):
        self.client.force_authenticate(None)
        r=self.client.get(f'/api/perfis/{self.u.pk}/')
        self.assertEqual(r.status_code,200)
<<<<<<< HEAD
        for field in ['email','nr_cpf','nr_cnpj','nr_telefone','chave_pix','fcm_token','password']: self.assertNotIn(field,r.data)
=======
<<<<<<< HEAD
        for field in ['email','nr_cpf','nr_telefone','chave_pix','fcm_token','password']: self.assertNotIn(field,r.data)
=======
        for field in ['email','nr_cpf','nr_cnpj','nr_telefone','chave_pix','fcm_token','password']: self.assertNotIn(field,r.data)
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
    def test_login_email(self):
        self.client.force_authenticate(None)
        r=self.client.post('/api/token/',{'username':'CUSTOMER@test.com','password':'Testing!8345'})
        self.assertEqual(r.status_code,200,r.data)
    def test_idempotent_request_and_description(self):
        pk=self.contract()
        r=self.client.post('/api/contratacoes/',self.data,format='json')
        self.assertEqual(r.status_code,200);self.assertEqual(r.data['id'],pk)
        self.assertEqual(Contratacao.objects.count(),1)
        self.assertEqual(Calendario.objects.count(),2)
        self.assertEqual(r.data['ds_solicitacao'],'Cinco telas');self.assertEqual(r.data['nm_endereco'],'Remoto')
    def test_favorites_private_and_idempotent(self):
        for _ in range(2): self.assertEqual(self.client.post('/api/favoritos/',{'anuncio':self.ad.pk}).status_code,201)
        self.assertEqual(Favorito.objects.count(),1)
        self.client.force_authenticate(self.other);self.assertEqual(self.client.get('/api/favoritos/').data,[])
        self.assertEqual(self.client.delete(f'/api/favoritos/{Favorito.objects.get().pk}/').status_code,404)
    def test_personal_event_conflict_blocks_contract(self):
        self.client.force_authenticate(self.p)
        r=self.client.post('/api/compromissos/',{'titulo':'Pessoal','data':self.day,'hora':'10:00','duracao':60})
        self.assertEqual(r.status_code,201,r.data)
        self.client.force_authenticate(self.u)
        self.assertEqual(self.client.post('/api/contratacoes/',self.data,format='json').status_code,400)
        self.assertEqual(self.client.get('/api/compromissos/').data,[])
    def test_reschedule_two_party_and_agendas(self):
        pk=self.contract()
        r=self.client.patch(f'/api/contratacoes/{pk}/reagendar/',{'data':self.day,'hora':'13:00'},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(self.client.patch(f'/api/contratacoes/{pk}/responder-reagendamento/',{'aceitar':True},format='json').status_code,403)
        self.client.force_authenticate(self.p)
        r=self.client.patch(f'/api/contratacoes/{pk}/responder-reagendamento/',{'aceitar':True},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(str(Contratacao.objects.get(pk=pk).hr_inicio),'13:00:00')
        self.assertEqual(Calendario.objects.filter(hr_inicio='13:00').count(),2)
    def test_blocking_chat_and_request(self):
        self.client.force_authenticate(self.p)
        self.assertEqual(self.client.post('/api/bloqueios/',{'bloqueado':self.u.pk}).status_code,201)
        self.client.force_authenticate(self.u)
        self.assertEqual(self.client.post('/api/mensagens/',{'destinatario':self.p.pk,'ds_mensagem':'Olá'}).status_code,403)
        self.assertEqual(self.client.post('/api/contratacoes/',self.data,format='json').status_code,403)
    def test_direct_chat_author_recipient_read_permissions(self):
        r=self.client.post('/api/mensagens/',{'destinatario':self.p.pk,'remetente':self.other.pk,'ds_mensagem':'Olá'})
        self.assertEqual(r.status_code,201,r.data);self.assertEqual(r.data['remetente'],self.u.pk)
        pk=r.data['id'];self.client.force_authenticate(self.p)
        self.assertEqual(self.client.delete(f'/api/mensagens/{pk}/').status_code,403)
        self.assertEqual(self.client.post('/api/mensagens/ler/',{'remetente':self.u.pk}).status_code,200)
        self.assertTrue(Mensagem.objects.get(pk=pk).lida)
        self.client.force_authenticate(self.other);self.assertEqual(self.client.get('/api/mensagens/').data,[])
    def test_protocol_server_identity_and_privacy(self):
        r=self.client.post('/api/suporte/',{'assunto':'Dúvida','texto':'Dúvida sobre o serviço','estado':'encerrado','resposta':'Falsa'})
        self.assertEqual(r.status_code,201,r.data)
        self.assertEqual(r.data['estado'],'aberto');self.assertEqual(r.data['resposta'],'')
        self.client.force_authenticate(self.other);self.assertEqual(self.client.get('/api/suporte/').data,[])
    def test_dispute_blocks_completion(self):
        pk=self.contract();self.client.force_authenticate(self.p)
        self.client.patch(f'/api/contratacoes/{pk}/aceitar/',{})
        self.client.force_authenticate(self.u)
        self.assertEqual(self.client.patch(f'/api/contratacoes/{pk}/contestar/',{'motivo':'Entrega com problema'},format='json').status_code,200)
        self.assertEqual(self.client.patch(f'/api/contratacoes/{pk}/concluir/',{}).status_code,400)
        self.assertEqual(Protocolo.objects.count(),1)
    def test_password_change_revokes_existing_jwt(self):
        token=str(AccessToken.for_user(self.u));self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+token)
        self.assertEqual(self.client.post('/api/usuarios/alterar-senha/',{'senha_atual':'wrong','nova_senha':'Changed!7563'}).status_code,400)
        self.assertEqual(self.client.post('/api/usuarios/alterar-senha/',{'senha_atual':'Testing!8345','nova_senha':'Changed!7563'}).status_code,200)
        self.assertEqual(self.client.get('/api/usuarios/me/').status_code,401)
    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_recovery_private_one_time_token(self):
        self.client.force_authenticate(None)
        known=self.client.post('/api/usuarios/recuperar-senha/',{'email':self.u.email})
        unknown=self.client.post('/api/usuarios/recuperar-senha/',{'email':'unknown@test.com'})
        self.assertEqual(known.data,unknown.data);self.assertEqual(len(mail.outbox),1)
        from urllib.parse import urlparse,parse_qs
        query=parse_qs(urlparse(mail.outbox[0].body).query)
        body={'uid':query['uid'][0],'token':query['token'][0],'password':'ResetGood!8791'}
        self.assertEqual(self.client.post('/api/usuarios/redefinir-senha/',body).status_code,200)
        self.assertEqual(self.client.post('/api/usuarios/redefinir-senha/',body).status_code,400)
    def test_delete_account_revokes_access_and_hides_profile(self):
        token=str(AccessToken.for_user(self.u))
        self.assertEqual(self.client.delete('/api/usuarios/excluir-conta/').status_code,204)
        self.client.force_authenticate(None);self.client.credentials(HTTP_AUTHORIZATION='Bearer '+token)
        self.assertEqual(self.client.get('/api/usuarios/me/').status_code,401)
        self.client.credentials();self.assertEqual(self.client.get(f'/api/perfis/{self.u.pk}/').status_code,404)

class DirectSocketTests(TransactionTestCase):
    def test_direct_socket_authentication_impersonation_and_block(self):
        u=Usuario.objects.create_user(username='dm-user');p=Usuario.objects.create_user(username='dm-peer')
        token=str(AccessToken.for_user(u))
        from setup.asgi import application
        async def scenario():
            socket=WebsocketCommunicator(application,f'/ws/conversa/{p.pk}/?token={token}')
            connected,_=await socket.connect();self.assertTrue(connected)
            await socket.send_json_to({'mensagem':'Olá ao vivo','remetente_id':p.pk})
            message=await socket.receive_json_from();self.assertEqual(message['remetente_id'],u.pk)
            await socket.disconnect()
        async_to_sync(scenario)()
        self.assertEqual(Mensagem.objects.get().destinatario_id,p.pk)
        Bloqueio.objects.create(usuario=p,bloqueado=u)
        async def denied():
            socket=WebsocketCommunicator(application,f'/ws/conversa/{p.pk}/?token={token}')
            connected,_=await socket.connect();self.assertFalse(connected);await socket.disconnect()
        async_to_sync(denied)()
