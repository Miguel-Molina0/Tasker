import django_filters
from .models import Anuncio

class AnunioFilter(django_filters.FilterSet)

    preco_min = django_filters.NumberFilter(field_name = 'vl_preco', lookup_expr='gte')
    preco_max = django_filters.NumberFilter(field_name = 'vl_preco', lookup_expr='lte')

    class Meta:
        model = Anuncio
        fields = ['fk_id_categoria', 'usuario', 'preco_min', 'preco_max']