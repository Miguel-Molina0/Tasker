"""Regressão: cadastro de autônomos exige CPF e CNPJ distintos e válidos."""
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Usuario


class CadastroCpfAutonomoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            'username': 'autonomo.cpf.teste@example.com',
            'email': 'autonomo.cpf.teste@example.com',
            'password': 'SenhaSegura#2026',
            'first_name': 'Profissional de Teste',
            'id_tp_perfil': 'autonomo',
            'nr_cpf': '529.982.247-25',
            'nr_cnpj': '11.222.333/0001-81',
        }

    def test_autonomo_guarda_cpf_e_cnpj(self):
        response = self.client.post('/api/usuarios/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        user = Usuario.objects.get(username=self.payload['username'])
        self.assertEqual(user.nr_cpf, '52998224725')
        self.assertEqual(user.nr_cnpj, '11222333000181')

    def test_autonomo_exige_cpf(self):
        data = dict(self.payload)
        data.pop('nr_cpf')
        response = self.client.post('/api/usuarios/', data, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('nr_cpf', response.data)

    def test_autonomo_rejeita_cpf_invalido(self):
        data = dict(self.payload, nr_cpf='111.111.111-11')
        response = self.client.post('/api/usuarios/', data, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('nr_cpf', response.data)

    def test_autonomo_rejeita_cnpj_invalido(self):
        data = dict(self.payload, nr_cnpj='11.222.333/0001-82')
        response = self.client.post('/api/usuarios/', data, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('nr_cnpj', response.data)
