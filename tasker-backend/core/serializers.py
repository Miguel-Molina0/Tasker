from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from .models import Usuario, Categoria, Anuncio, Servico, Contratacao, Pagamento, Calendario, Avaliacao, Mensagem

class Base64ImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if isinstance(data, str) and data.startswith('data:image/'):
            import base64, binascii, uuid
            from django.core.files.base import ContentFile
            if len(data) > 2000000: raise serializers.ValidationError('Foto muito grande.')
            try:
                header, raw = data.split(';base64,',1)
                extension = header.split('/')[-1]
                if extension not in ['png','jpeg','jpg','webp']: raise ValueError()
                data = ContentFile(base64.b64decode(raw,validate=True), name=f'{uuid.uuid4()}.{extension}')
            except (ValueError,binascii.Error): raise serializers.ValidationError('Foto inválida.')
        return super().to_internal_value(data)

class UsuarioSerializer(serializers.ModelSerializer):
    tp_foto = Base64ImageField(required=False, allow_null=True)
    class Meta:
        model = Usuario
        fields = ['id','username','email','password','nr_cpf','nr_cnpj','nr_telefone','ds_biografia','tp_foto','id_tp_perfil','first_name','nm_cidade','dt_nascimento',
                  'fcm_token','chave_pix','tipo_chave_pix']
        extra_kwargs = {'password': {'write_only':True, 'required':True}, 'fcm_token':{'write_only':True},
                        'chave_pix':{'write_only':True}, 'tipo_chave_pix':{'write_only':True}}
    def validate_password(self, value):
        candidate = self.instance or Usuario(username=self.initial_data.get('username',''), email=self.initial_data.get('email',''))
        try: validate_password(value, candidate)
        except DjangoValidationError as exc: raise serializers.ValidationError(exc.messages)
        return value
    def validate_email(self, value):
        value = value.strip().lower()
        qs = Usuario.objects.filter(email__iexact=value, is_active=True)
        if self.instance: qs = qs.exclude(pk=self.instance.pk)
        if value and qs.exists(): raise serializers.ValidationError('Email já cadastrado.')
        return value
    def validate_dt_nascimento(self, value):
        if value:
            today = timezone.localdate()
            age = today.year-value.year-((today.month,today.day)<(value.month,value.day))
            if age < 18 or value.year < 1900: raise serializers.ValidationError('É necessário ter 18 anos ou mais.')
        return value
    def validate(self, attrs):
        perfil = attrs.get('id_tp_perfil', getattr(self.instance, 'id_tp_perfil', 'contratante'))
        cpf = attrs.get('nr_cpf', getattr(self.instance, 'nr_cpf', None))
        cnpj = attrs.get('nr_cnpj', getattr(self.instance, 'nr_cnpj', None))
        def digits(value): return ''.join(c for c in str(value or '') if c.isdigit())
        def cpf_ok(value):
            d = digits(value)
            if len(d) != 11 or len(set(d)) == 1: return False
            for n in (9, 10):
                v = (sum(int(d[i]) * (n + 1 - i) for i in range(n)) * 10) % 11
                if (0 if v == 10 else v) != int(d[n]): return False
            return True
        def cnpj_ok(value):
            d = digits(value)
            if len(d) != 14 or len(set(d)) == 1: return False
            for n, weights in ((12, [5,4,3,2,9,8,7,6,5,4,3,2]), (13, [6,5,4,3,2,9,8,7,6,5,4,3,2])):
                check = (sum(int(d[i]) * weights[i] for i in range(n)) * 10) % 11
                if (0 if check == 10 else check) != int(d[n]): return False
            return True
        if perfil == 'autonomo':
            if not cnpj_ok(cnpj): raise serializers.ValidationError({'nr_cnpj': 'Informe um CNPJ válido de 14 dígitos.'})
            attrs['nr_cnpj'] = digits(cnpj)
            attrs['nr_cpf'] = None
        elif perfil == 'contratante':
            if not cpf_ok(cpf): raise serializers.ValidationError({'nr_cpf': 'Informe um CPF válido de 11 dígitos.'})
            attrs['nr_cpf'] = digits(cpf)
            attrs['nr_cnpj'] = None
        return attrs
    def create(self, validated_data):
        password = validated_data.pop('password')
        return Usuario.objects.create_user(password=password, **validated_data)
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password is not None:
            instance.set_password(password)
            instance.save(update_fields=['password'])
        return instance

class AnuncioSerializer(serializers.ModelSerializer):
    distancia_km = serializers.FloatField(read_only=True)
    def validate_imagens(self, value):
        return validate_images(value)
    def validate_dias_atendimento(self, value):
        if not isinstance(value,list) or not value or any(type(d) is not int or not 0<=d<=6 for d in value):
            raise serializers.ValidationError('Escolha os dias de atendimento.')
        return sorted(set(value))
    class Meta:
        model = Anuncio
        fields = '__all__'
        read_only_fields = ['fk_id_usuario','dt_criacao_anuncio']

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'

class ServicoSerializer(serializers.ModelSerializer):
    categorias_detalhes = CategoriaSerializer(source='categorias', many=True, read_only=True)
    class Meta:
        model = Servico
        fields = '__all__'
        read_only_fields = ['fk_id_usuario']
    def validate_fk_id_anuncio(self, anuncio):
        if anuncio.fk_id_usuario != self.context['request'].user:
            raise serializers.ValidationError('Escolha um anúncio de sua autoria.')
        return anuncio

class ContratacaoSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='fk_id_cliente.username', read_only=True)
    anuncio_titulo = serializers.CharField(source='fk_id_anuncio.nm_titulo', read_only=True)
    prestador_id = serializers.IntegerField(source='fk_id_anuncio.fk_id_usuario_id', read_only=True)
    class Meta:
        model = Contratacao
        fields = '__all__'
        read_only_fields = ['fk_id_cliente','st_status','concluido_cliente','concluido_prestador','dt_criacao','dt_atualizacao','proposta_reagendamento','contestado','motivo_contestacao']
        extra_kwargs = {x:{'required':True,'allow_null':False} for x in ['dt_agendamento','hr_inicio','hr_final']}
    def validate(self, data):
        anuncio = data['fk_id_anuncio']
        if anuncio.fk_id_usuario == self.context['request'].user:
            raise serializers.ValidationError('Você não pode contratar o próprio serviço.')
        if not anuncio.st_anuncio:
            raise serializers.ValidationError('Este anúncio está inativo.')
        if data['dt_agendamento'] < timezone.localdate():
            raise serializers.ValidationError('Escolha uma data atual ou futura.')
        if data['hr_inicio'] >= data['hr_final']:
            raise serializers.ValidationError('O início deve ser anterior ao fim.')
        if data['dt_agendamento'] == timezone.localdate() and data['hr_inicio'] <= timezone.localtime().time().replace(tzinfo=None):
            raise serializers.ValidationError('O horário escolhido já passou.')
        days = anuncio.dias_atendimento
        if days and ((data['dt_agendamento'].weekday()+1)%7) not in days:
            raise serializers.ValidationError('O prestador não atende neste dia da semana.')
        from .integration import valid_schedule
        from datetime import datetime
        duration = int((datetime.combine(data['dt_agendamento'],data['hr_final'])-datetime.combine(data['dt_agendamento'],data['hr_inicio'])).total_seconds()/60)
        valid_schedule(data['dt_agendamento'],data['hr_inicio'],duration)
        return data

class CalendarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calendario
        fields = '__all__'

class PagamentoSerializer(serializers.ModelSerializer):
    status_contratacao = serializers.CharField(source='fk_id_contratacao.st_status', read_only=True)
    class Meta:
        model = Pagamento
        fields = ['id','fk_id_contratacao','vl_servico','st_pagamento','dt_declaracao_pagamento',
                  'asaas_payment_id','asaas_transfer_id','pix_qr_code','pix_copia_cola','status_contratacao','dt_estorno']
        read_only_fields = fields

class AvaliacaoSerializer(serializers.ModelSerializer):
    fk_id_contratacao = serializers.PrimaryKeyRelatedField(queryset=Contratacao.objects.all())
    avaliador_nome = serializers.CharField(source='avaliador.username', read_only=True)
    avaliado_nome = serializers.CharField(source='avaliado.username', read_only=True)
    class Meta:
        model = Avaliacao
        fields = '__all__'
        read_only_fields = ['avaliador','avaliado','dt_criacao']
        extra_kwargs = {'fk_id_contratacao':{'read_only':False,'required':True}}
    def validate(self, data):
        user = self.context['request'].user
        contrato = self.instance.fk_id_contratacao if self.instance else data.get('fk_id_contratacao')
        if self.instance and 'fk_id_contratacao' in data and data['fk_id_contratacao'] != contrato:
            raise serializers.ValidationError('Não é permitido trocar a contratação da avaliação.')
        if contrato.st_status != 'CONCLUIDO':
            raise serializers.ValidationError('O serviço deve estar concluído.')
        if user.id not in [contrato.fk_id_cliente_id,contrato.fk_id_anuncio.fk_id_usuario_id]:
            raise serializers.ValidationError('Você não participa desta contratação.')
        if not self.instance and Avaliacao.objects.filter(fk_id_contratacao=contrato,avaliador=user).exists():
            raise serializers.ValidationError('Você já avaliou esta contratação.')
        return data

class MensagemSerializer(serializers.ModelSerializer):
    remetente_username = serializers.CharField(source='remetente.username', read_only=True)
    class Meta:
        model = Mensagem
        fields = ['id','fk_id_contratacao','destinatario','remetente','remetente_username','ds_mensagem','dt_envio','lida']
        read_only_fields = ['remetente','dt_envio','lida']
    def validate_ds_mensagem(self, value):
        value = value.strip()
        if not value or len(value) > 4000: raise serializers.ValidationError('Envie de 1 a 4000 caracteres.')
        return value

class WebhookSerializer(serializers.Serializer):
    event = serializers.CharField()
    payment = serializers.DictField(required=False)
    transfer = serializers.DictField(required=False)


def validate_images(value):
    if not isinstance(value,list) or len(value)>4: raise serializers.ValidationError('Envie até 4 imagens.')
    for image in value:
        if not isinstance(image,str) or len(image)>2000000 or not image.startswith('data:image/'):
            raise serializers.ValidationError('Envie imagens da galeria até 1,5 MB cada.')
        import base64, binascii, io
        from PIL import Image
        try:
            header, encoded = image.split(';base64,',1)
            if header not in ['data:image/png','data:image/jpeg','data:image/jpg','data:image/webp']: raise ValueError()
            im=Image.open(io.BytesIO(base64.b64decode(encoded,validate=True)))
            im.verify()
        except (ValueError,binascii.Error,OSError,Image.DecompressionBombError):
            raise serializers.ValidationError('Arquivo de imagem inválido.')
    return value

class PerfilPublicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id','username','first_name','ds_biografia','nm_cidade','tp_foto','id_tp_perfil']
