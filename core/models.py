from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser

class Usuario(AbstractUser):
    PERFIL_CHOICES = [
        ('autonomo', 'Autônomo'),
        ('contratante', 'Contratante'),
    ]
    
    nr_cpf = models.CharField(max_length=14, unique=True, null=True, blank=True)
    nr_telefone = models.CharField(max_length=15, null=True, blank=True)
    ds_biografia = models.TextField(blank=True, null=True)
    tp_foto = models.ImageField(upload_to='perfis/', blank=True, null=True)
    id_tp_perfil = models.CharField(max_length=15, choices=PERFIL_CHOICES, default='contratante')

    def __str__(self):
        return self.username

class Categoria(models.Model):
    nm_categoria = models.CharField(max_length=45)

    def __str__(self):
        return self.nm_categoria


class Anuncio(models.Model):
    nm_titulo = models.CharField(max_length=50)
    nm_descricao = models.CharField(max_length=150)
    vl_preco = models.DecimalField(max_digits=10, decimal_places=2)
    nm_area_atendimento = models.CharField(max_length=100)
    nm_disponibilidade = models.CharField(max_length=45)
    st_anuncio = models.BooleanField(default=True) # Substituindo o tinyint por Boolean
    fk_id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)


class Servico(models.Model):
    nm_servico = models.CharField(max_length=100)
    ds_servico = models.TextField(blank=True, null=True)
    fk_id_anuncio = models.ForeignKey(Anuncio, on_delete=models.CASCADE)
    fk_id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    
    categorias = models.ManyToManyField(Categoria, related_name='servicos')

class Contratacao(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('aceito', 'Aceito'),
        ('recusado', 'Recusado'),
        ('em andamento', 'Em andamento'),
    ]

    dt_contratacao = models.DateField()
    st_contratacao = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    vl_final_contratacao = models.DecimalField(max_digits=10, decimal_places=2)
    dt_execucao = models.DateField()
    hr_execucao = models.TimeField()
    
   
    fk_id_contratante = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='contratacoes_feitas')
    fk_id_autonomo = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='servicos_prestados')
    fk_id_servico = models.ForeignKey(Servico, on_delete=models.CASCADE)

    def __str__(self):
        return f"Contratação #{self.id} - {self.st_contratacao}"

class Pagamento(models.Model):
    STATUS_PAGAMENTO = [
        ('retido', 'Retido'),
        ('liberado', 'Liberado'),
        ('bloqueado', 'Bloqueado'),
    ]

    vl_servico = models.DecimalField(max_digits=10, decimal_places=2)
    nm_token_api = models.CharField(max_length=150, blank=True, null=True)
    st_pagamento = models.CharField(max_length=15, choices=STATUS_PAGAMENTO)
    dt_declaracao_pagamento = models.DateTimeField(blank=True, null=True)
    fk_id_contratacao = models.ForeignKey(Contratacao, on_delete=models.CASCADE)


class Calendario(models.Model):
    dt_agendamento = models.DateField()
    hr_inicio = models.TimeField()
    hr_final = models.TimeField()
    st_agendamento = models.CharField(max_length=45, blank=True, null=True)
    fk_id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    fk_id_contratacao = models.ForeignKey(Contratacao, on_delete=models.CASCADE)


class Chat(models.Model):
    tx_mensagem = models.TextField()
    dt_envio = models.DateTimeField(auto_now_add=True) # Preenche a data/hora automaticamente ao enviar
    st_visualizacao = models.BooleanField(default=False)
    fk_id_remetente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='mensagens_enviadas')
    fk_id_destinatario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='mensagens_recebidas')


class Avaliacao(models.Model):
    nr_nota = models.IntegerField()
    ds_comentario = models.TextField(blank=True, null=True)
    dt_avaliacao = models.DateField(auto_now_add=True)
    fk_id_contratacao = models.ForeignKey(Contratacao, on_delete=models.CASCADE)
    fk_id_avaliador = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='avaliacoes_feitas')
    fk_id_avaliado = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='avaliacoes_recebidas')

class Mensagem(models.Model):
    fk_id_contratacao = models.ForeignKey('Contratacao', on_delete=models.CASCADE, related_name='mensagens')
    remetente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ds_mensagem = models.TextField()
    dt_envio = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.remetente.username}: {self.ds_mensagem[:20]}"    