from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from .models import Usuario, Categoria, Anuncio, Contratacao, Pagamento, Protocolo

class PainelAdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = Usuario.objects.create_user(username='adminpanel',password='AdminTest!234',is_staff=True)
        cls.user = Usuario.objects.create_user(username='cliente',password='ClienteTest!234')
        cls.worker = Usuario.objects.create_user(username='profissional',password='WorkerTest!234',id_tp_perfil='autonomo')
        cls.cat = Categoria.objects.create(nm_categoria='Reparos')
        cls.ad = Anuncio.objects.create(nm_titulo='Serviço de teste',nm_descricao='Teste',vl_preco=Decimal('120.00'),nm_area_atendimento='Santos',nm_disponibilidade='Dias úteis',fk_id_usuario=cls.worker,fk_id_categoria=cls.cat)
        cls.contract = Contratacao.objects.create(fk_id_cliente=cls.user,fk_id_anuncio=cls.ad)
        cls.payment = Pagamento.objects.create(fk_id_contratacao=cls.contract,vl_servico=Decimal('120.00'),st_pagamento='aguardando')
        cls.support = Protocolo.objects.create(usuario=cls.user, assunto='Ajuda', texto='Problema no app')

    def test_guest_redirects_to_login(self):
        self.assertRedirects(self.client.get(reverse('painel_inicio')), reverse('painel_login')+'?next=/painel/')

    def test_normal_user_cannot_access(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse('painel_inicio')).status_code,403)

    def test_staff_can_open_pages(self):
        self.client.force_login(self.staff)
        for name in ['painel_inicio','painel_usuarios','painel_anuncios','painel_contratacoes','painel_pagamentos','painel_suporte','painel_relatorios']:
            with self.subTest(name=name):
                self.assertEqual(self.client.get(reverse(name)).status_code,200)

    def test_user_suspension_post_only_and_protect_staff(self):
        self.client.force_login(self.staff)
        url=reverse('painel_usuario_status',args=[self.user.pk])
        self.assertEqual(self.client.get(url).status_code,405)
        self.assertEqual(self.client.post(url).status_code,302)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.client.post(reverse('painel_usuario_status',args=[self.staff.pk]))
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.is_active)

    def test_ad_toggle(self):
        self.client.force_login(self.staff)
        self.client.post(reverse('painel_anuncio_status',args=[self.ad.pk]))
        self.ad.refresh_from_db()
        self.assertFalse(self.ad.st_anuncio)

    def test_payment_read_only_and_csv(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get(reverse('painel_pagamentos')).status_code,200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.st_pagamento,'aguardando')
        response=self.client.get(reverse('painel_exportar')+'?tipo=pagamentos')
        self.assertEqual(response.status_code,200)
        self.assertIn('text/csv',response['Content-Type'])

    def test_support_reply(self):
        self.client.force_login(self.staff)
        self.client.post(reverse('painel_protocolo_responder',args=[self.support.pk]),{'resposta':'Vamos ajudar','estado':'respondido'})
        self.support.refresh_from_db()
        self.assertEqual(self.support.resposta,'Vamos ajudar')
        self.assertEqual(self.support.estado,'respondido')
