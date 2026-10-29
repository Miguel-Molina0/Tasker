from decimal import Decimal
from django.db import models
from django.conf import settings  # pyright: ignore[reportMissingImports]
from django.contrib.auth.models import AbstractUser  
from django.core.validators import MinValueValidator, MaxValueValidator

class Usuario(AbstractUser):
    nm_cidade = models.CharField(max_length=100, blank=True, default="")
    dt_nascimento = models.DateField(null=True, blank=True)
    PERFIL_CHOICES = [
        ('autonomo', 'Autônomo'),
        ('contratante', 'Contratante'),
    ]
    
    nr_cpf = models.CharField(max_length=14, unique=True, null=True, blank=True)
    nr_cnpj = models.CharField(max_length=14, unique=True, null=True, blank=True)
    nr_telefone = models.CharField(max_length=15, null=True, blank=True)
    ds_biografia = models.TextField(blank=True, null=True)
    tp_foto = models.ImageField(upload_to='perfis/', blank=True, null=True)
    id_tp_perfil = models.CharField(max_length=15, choices=PERFIL_CHOICES, default='contratante')
    fcm_token = models.CharField(max_length=255, blank=True, null=True)  
    asaas_customer_id = models.CharField(max_length=80, blank=True, null=True)
    tipo_chave_pix = models.CharField(max_length=10, choices=[(x,x) for x in ['EVP','CPF','CNPJ','EMAIL','PHONE']], default='EVP')
    chave_pix = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.username

class Categoria(models.Model):
    nm_categoria = models.CharField(max_length=45)

    def __str__(self):
        return self.nm_categoria


class Anuncio(models.Model):
    nm_titulo = models.CharField(max_length=100)
    nm_descricao = models.TextField(max_length=2000)
    imagens = models.JSONField(default=list, blank=True)
    dias_atendimento = models.JSONField(default=list, blank=True)
    vl_preco = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    nr_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, validators=[MinValueValidator(-90), MaxValueValidator(90)])
    nr_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True, validators=[MinValueValidator(-180), MaxValueValidator(180)])
    nm_area_atendimento = models.CharField(max_length=100)
    nm_disponibilidade = models.CharField(max_length=45)
    st_anuncio = models.BooleanField(default=True) # Substituindo o tinyint por Boolean
    fk_id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    fk_id_categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE)
    dt_criacao_anuncio = models.DateTimeField(auto_now_add=True)


class Servico(models.Model):
    nm_servico = models.CharField(max_length=100)
    ds_servico = models.TextField(blank=True, null=True)
    fk_id_anuncio = models.ForeignKey(Anuncio, on_delete=models.CASCADE)
    fk_id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    
    categorias = models.ManyToManyField(Categoria, related_name='servicos')

class Contratacao(models.Model):
    chave_solicitacao = models.CharField(max_length=64, null=True, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["fk_id_cliente","chave_solicitacao"],name="contrato_cliente_chave_unica")]
    contestado = models.BooleanField(default=False)
    motivo_contestacao = models.TextField(blank=True, default="")
    ds_solicitacao = models.TextField(blank=True, default="")
    nm_endereco = models.CharField(max_length=300, blank=True, default="")
    proposta_reagendamento = models.JSONField(null=True, blank=True)
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('ACEITO', 'Aceito'),
        ('RECUSADO', 'Recusado'),
        ('CONCLUIDO', 'Concluído'),
        ('CANCELADO', 'Cancelado'),
    ]

    fk_id_cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='contratacoes_cliente'
    )
    fk_id_anuncio = models.ForeignKey(
        'Anuncio', 
        on_delete=models.CASCADE, 
        related_name='contratacoes_anuncio'
    )
    st_status = models.CharField(
        max_length=15, 
        choices=STATUS_CHOICES, 
        default='PENDENTE'
    )
    concluido_cliente =  models.BooleanField(default=False)
    concluido_prestador = models.BooleanField(default=False)    

    dt_criacao = models.DateTimeField(auto_now_add=True)
    dt_atualizacao = models.DateTimeField(auto_now=True)
    dt_agendamento = models.DateField(null=True, blank=True)
    hr_inicio = models.TimeField(null=True, blank=True)
    hr_final = models.TimeField(null=True, blank=True)
    nr_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    nr_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    def __str__(self):
        return f"Contratação #{self.id} - {self.fk_id_anuncio.nm_titulo} ({self.st_status})"

class Pagamento(models.Model):
    class Meta:
        constraints = [models.UniqueConstraint(fields=['fk_id_contratacao'], name='pagamento_contrato_unico')]

    STATUS_PAGAMENTO = [
        ('aguardando', 'Aguardando pagamento'),
        ('processando', 'Repasse em processamento'),
        ('retido', 'Retido'),
        ('liberado', 'Liberado'),
        ('bloqueado', 'Bloqueado'),
    ]

    vl_servico = models.DecimalField(max_digits=10, decimal_places=2)
    nm_token_api = models.CharField(max_length=150, blank=True, null=True)
    st_pagamento = models.CharField(max_length=15, choices=STATUS_PAGAMENTO)
    dt_declaracao_pagamento = models.DateTimeField(blank=True, null=True)
    fk_id_contratacao = models.ForeignKey(Contratacao, on_delete=models.CASCADE)
    asaas_payment_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    asaas_transfer_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    repasse_tentado = models.BooleanField(default=False)
    estorno_tentado = models.BooleanField(default=False)
    dt_estorno = models.DateTimeField(null=True, blank=True)
    erro_integracao = models.TextField(blank=True, default='')
    pix_qr_code = models.TextField(blank=True, null=True)
    pix_copia_cola = models.TextField(blank=True, null=True)

class Calendario(models.Model):
    class Meta:
        constraints = [models.UniqueConstraint(fields=['fk_id_usuario', 'fk_id_contratacao'], name='agenda_usuario_contrato_unico')]

    dt_agendamento = models.DateField()
    hr_inicio = models.TimeField()
    hr_final = models.TimeField()
    st_agendamento = models.CharField(max_length=45, blank=True, null=True)
    fk_id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    fk_id_contratacao = models.ForeignKey(Contratacao, on_delete=models.CASCADE)

class Avaliacao(models.Model):
    
    fk_id_contratacao = models.ForeignKey(
        'Contratacao',
        on_delete=models.CASCADE,
        related_name='avaliacoes'
    )
    avaliador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='avaliacoes_feitas'
    )
    avaliado = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='avaliacoes_recebidas'
    )
    nr_nota = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Nota de 1 a 5 estrelas"
    )
    ds_comentario = models.TextField(blank=True, null=True)
    dt_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['fk_id_contratacao','avaliador'], name='avaliacao_autor_contrato_unica')]
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'
    
class Mensagem(models.Model):
    fk_id_contratacao = models.ForeignKey('Contratacao', on_delete=models.CASCADE, related_name='mensagens', null=True, blank=True)
    destinatario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mensagens_recebidas', null=True, blank=True)
    lida = models.BooleanField(default=False)
    remetente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ds_mensagem = models.TextField()
    dt_envio = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.remetente.username}: {self.ds_mensagem[:20]}"    

class Favorito(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    anuncio = models.ForeignKey(Anuncio, on_delete=models.CASCADE)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['usuario','anuncio'], name='favorito_usuario_anuncio_unico')]

class Bloqueio(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bloqueios')
    bloqueado = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bloqueado_por')
    class Meta:
        constraints = [models.UniqueConstraint(fields=['usuario','bloqueado'], name='bloqueio_usuario_alvo_unico')]

class CompromissoPessoal(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    titulo = models.CharField(max_length=100)
    data = models.DateField()
    hora = models.TimeField()
    duracao = models.PositiveIntegerField(default=60, validators=[MinValueValidator(30),MaxValueValidator(480)])
    observacoes = models.TextField(blank=True,default='')

class Protocolo(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    assunto = models.CharField(max_length=150)
    texto = models.TextField(max_length=4000)
    alvo = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='relatos_recebidos')
    criado = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, default='aberto', choices=[('aberto','Aberto'),('respondido','Respondido'),('encerrado','Encerrado')])
    resposta = models.TextField(blank=True,default='')

class Notificacao(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    texto = models.CharField(max_length=300)
    rota = models.CharField(max_length=60,default='meus-servicos')
    alvo = models.CharField(max_length=30,blank=True,default='')
    lida = models.BooleanField(default=False)
    criado = models.DateTimeField(auto_now_add=True)
