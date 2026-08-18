from rest_framework import serializers
from .models import Categoria, Contratacao, Mensagem, Servico, Usuario, Anuncio, Pagamento, Chat, Calendario, Avaliacao

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'email', 'password', 
            'nr_cpf', 'nr_telefone', 'ds_biografia', 
            'tp_foto', 'id_tp_perfil'
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        # Remove a senha dos dados e cria usando create_user para salvar com Hash
        password = validated_data.pop('password', None)
        instance = self.Meta.model(**validated_data)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance

class AnuncioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Anuncio
        fields = '__all__'
    
class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class ServicoSerializer(serializers.ModelSerializer):
    
    categorias_detalhes = CategoriaSerializer(source='categorias', many=True, read_only=True)
    class Meta:
        model = Servico
        fields = '__all__'
    

class ContratacaoSerializer(serializers.ModelSerializer):
    
    nome_contratante = serializers.CharField(source='fk_id_contratante.nm_usuario', read_only=True)
    nome_autonomo = serializers.CharField(source='fk_id_autonomo.nm_usuario', read_only=True)
    nome_servico = serializers.CharField(source='fk_id_servico.nm_servico', read_only=True)

    class Meta:
        model = Contratacao
        fields = '__all__'

class PagamentoSerializer(serializers.ModelSerializer):
    
    status_contratacao = serializers.CharField(source='fk_id_contratacao.st_contratacao', read_only=True)
    valor_contratacao = serializers.DecimalField(source='fk_id_contratacao.vl_final_contratacao', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Pagamento
        fields = '__all__'

class CalendarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calendario
        fields = '__all__'

class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = '__all__'  

class AvaliacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avaliacao
        fields = '__all__'


class MensagemSerializer(serializers.ModelSerializer):
    # Traz dados úteis do remetente para exibir o nome e a foto no chat
    remetente_username = serializers.CharField(source='remetente.username', read_only=True)
    remetente_foto = serializers.ImageField(source='remetente.tp_foto', read_only=True)

    class Meta:
        model = Mensagem
        fields = [
            'id', 
            'fk_id_contratacao', 
            'remetente', 
            'remetente_username', 
            'remetente_foto', 
            'ds_mensagem', 
            'dt_envio'
        ]
        read_only_fields = ['dt_envio']