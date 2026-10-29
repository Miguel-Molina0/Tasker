from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('core', '0006_bloqueio_compromissopessoal_favorito_notificacao_and_more')]
    operations = [migrations.AddField(model_name='usuario', name='nr_cnpj', field=models.CharField(blank=True, max_length=14, null=True, unique=True))]
