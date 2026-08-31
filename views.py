from rest_framework import viewsets
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly 
from .fliters import AnuncioFilter
from .models import Calendario, Avaliacao, Mensagem, Pagamento, Chat, Categoria, Usuario, Anuncio, Servico, Contratacao
from .serializers import MensagemSerializer, CalendarioSerializer, CategoriaSerializer,UsuarioSerializer, AnuncioSerializer, ServicoSerializer, ContratacaoSerializer, ChatSerializer, AvaliacaoSerializer, PagamentoSerializer 

class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    @action(detail=False, methods=['get', 'put', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        user = request.user 

        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)

        elif request.method in ['PUT', 'PATCH']:
            
            is_partial = True if request.method == 'PATCH' else False

            serializer = self.get_serializer(
                instance=user, 
                data=request.data, 
                partial=is_partial  
            )

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AnuncioViewSet(viewsets.ModelViewSet):

    queryset = Anuncio.objects.all()
    serializer_class = AnuncioSerializer

    permission_classes = [IsAuthenticatedOrReadOnly]

    queryset = Anuncio.objects.all().order_by('dt_criacao')
    serializer_class = AnuncioSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AnuncioFilter
    search_fields = ['nm_titulo', 'ds_anuncio']
    ordering_fields = ['vl_preco', 'ds_anuncio']
    ordering = ['dt_criacao']

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

class ServicoViewSet(viewsets.ModelViewSet):

    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer

    permission_classes = [IsAuthenticatedOrReadOnly]

class ContratacaoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratacaoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        return Contratacao.objects.filter(
            Q(fk_id_cliente=user)
            Q(fk_id_anuncio__usuario=user)
        ).order_by('dt_criacao')

    def perform_create(self, serializer):
        serializer.save(fk_id_cliente=self.request.user)

    @action(detail=True, methods=['patch'], url_path="aceitar")
    def aceitar(self, request, pk=None)
        contratacao = self.get.object()

        if contratacao.fk_id_anuncio.usuario != request.user:
            raise PermissionDenied("Apenas o prestador o serviço pode aceitar esta contratação")
        
        if contratacao.st_status != 'Pendente':
            raise ValidationError(f"Não é possível aceitar uma contratação com status '{contratacao.st_status}.")

        contratacao.st_status = 'Aceito'
        contratacao.save()

        return Response({'status': 'Contratação aceita com sucesso!', 'dados': self.get.serializer(contratacao).data})   

    @action(detail=True, methods=['patch'], url_path="aceitar")
    def recusar(self, request, pk=None)
        contratacao = self.get.object()

        if contratacao.fk_id_anuncio.usuario != request.user:
            raise PermissionDenied("Apenas o prestador o serviço pode recusar esta contratação")
        
        if contratacao.st_status != 'Pendente':
            raise ValidationError(f"Não é possível aceitar uma contratação com status '{contratacao.st_status}.")

        contratacao.st_status = 'Recusado'
        contratacao.save()

        return Response({'status': 'Contratação recusada.'})

    @action(detail=True, methods=['patch'], url_path="aceitar")
    def concluir(self, request, pk=None)
        contratacao = self.get.object()

        if contratacao.fk_id_anuncio.usuario != request.user:
            raise PermissionDenied("Apenas o prestador o serviço pode concluir esta contratação")
        
        if contratacao.st_status != 'Aceito':
            raise ValidationError(f"Apenas serviços com status 'Aceito' podem ser concluídos")

        contratacao.st_status = 'Concluído'
        contratacao.save()

        return Response({'status': 'Serviço marcado como concluído'})



class CategoriaViewSet(viewsets.ModelViewSet):

    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer

    permission_classes = [IsAuthenticatedOrReadOnly]

class CalendarioViewSet(viewsets.ModelViewSet):

    queryset = Calendario.objects.all()
    serializer_class = CalendarioSerializer

class ChatViewSet(viewsets.ModelViewSet):

    queryset = Chat.objects.all()
    serializer_class = ChatSerializer

    permission_classes = [IsAuthenticated]

class AvaliacaoViewSet(viewsets.ModelViewSet):

    queryset = Avaliacao.objects.all()
    serializer_class = AvaliacaoSerializer



class PagamentoViewSet(viewsets.ModelViewSet):

    queryset = Pagamento.objects.all()
    serializer_class = PagamentoSerializer

    permission_classes = [IsAuthenticated]

class MensagemViewSet(viewsets.ModelViewSet):
    serializer_class = MensagemSerializer
    permission_classes = [IsAuthenticated] 
    def get_queryset(self):
       user = self.request.user

       queryset = Mensagem.objects.filter(
         Q(fk_id_contratacao__fk_id_cliente=user) 
         Q(fk_id_contratacao__fk_id_anuncio__usuario=user)
       ).order_by('dt_envio')

       contratacao_id = self.request.query_params.get('contratacao', None)
        if contratacao_id is not None:
            queryset = queryset.filter(fk_id_contratacao_id=contratacao_id)
            
        return queryset
    
    def perform_create(self, serializer):
        contratacao = serializer.validated_data.get('fk_id_contratacao')
        user = self.request.username

        eh_cliente = (contratacao.fk_id_cliente == user)
        eh_prestador = (contratacao.fk_id_anuncio.usuario == user)

        if not(eh_cliente or eh_prestador)
            raise PermissionDenied("você não tem permissão enviar mensagens nesta contratação")

        serializer.save(rememtente=user)
