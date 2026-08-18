from rest_framework import viewsets
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly 
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

class ServicoViewSet(viewsets.ModelViewSet):

    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer

    permission_classes = [IsAuthenticatedOrReadOnly]

class ContratacaoViewSet(viewsets.ModelViewSet):

    queryset = Contratacao.objects.all()
    serializer_class = ContratacaoSerializer

    permission_classes = [IsAuthenticatedOrReadOnly]

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
    permission_classes = [IsAuthenticated] # Exige login para ver o histórico

    def get_queryset(self):
        """
        Retorna as mensagens filtradas por ?contratacao=<id> ordenadas por data.
        """
        queryset = Mensagem.objects.all().order_by('dt_envio')
        contratacao_id = self.request.query_params.get('contratacao', None)
        
        if contratacao_id is not None:
            queryset = queryset.filter(fk_id_contratacao_id=contratacao_id)
            
        return queryset