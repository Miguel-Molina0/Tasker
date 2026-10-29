import django_filters
from django.db.models import F, Value, FloatField
from django.db.models.functions import Cos, Sin, Radians, ACos, Least, Greatest, Cast
from rest_framework.exceptions import ValidationError
from .models import Anuncio
class AnuncioFilter(django_filters.FilterSet):
    preco_min = django_filters.NumberFilter(field_name='vl_preco',lookup_expr='gte')
    preco_max = django_filters.NumberFilter(field_name='vl_preco',lookup_expr='lte')
    latitude = django_filters.NumberFilter(method='filtrar_por_distancia')
    longitude = django_filters.NumberFilter(method='filtrar_por_distancia')
    raio_km = django_filters.NumberFilter(method='filtrar_por_distancia')
    class Meta:
        model = Anuncio
        fields = ['fk_id_categoria','fk_id_usuario','st_anuncio','preco_min','preco_max']
    def filtrar_por_distancia(self, queryset, name, value):
        if name != 'latitude' and self.data.get('latitude'): return queryset
        try:
            lat, lon = float(self.data['latitude']), float(self.data['longitude'])
            radius = float(self.data.get('raio_km',15))
        except (KeyError,ValueError,TypeError): raise ValidationError('Informe latitude e longitude válidas.')
        if not (-90 <= lat <= 90 and -180 <= lon <= 180 and 0 < radius <= 1000):
            raise ValidationError('Coordenadas inválidas ou raio fora do intervalo 0–1000 km.')
        expression = Cos(Radians(Value(lat))) * Cos(Radians(Cast(F('nr_latitude'), FloatField()))) * Cos(
            Radians(Cast(F('nr_longitude'), FloatField()))-Radians(Value(lon))) + Sin(Radians(Value(lat))) * Sin(Radians(Cast(F('nr_latitude'), FloatField())))
        return queryset.filter(nr_latitude__isnull=False,nr_longitude__isnull=False).annotate(
            distancia_km=6371*ACos(Least(Value(1.0),Greatest(Value(-1.0),expression)))
        ).filter(distancia_km__lte=radius).order_by('distancia_km')
