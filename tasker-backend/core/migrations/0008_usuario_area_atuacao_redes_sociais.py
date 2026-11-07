from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('core', '0007_usuario_nr_cnpj')]
    operations = [
        migrations.AddField(model_name='usuario', name='area_atuacao', field=models.CharField(blank=True, default='', max_length=80)),
        migrations.AddField(model_name='usuario', name='instagram', field=models.URLField(blank=True, default='', max_length=250)),
        migrations.AddField(model_name='usuario', name='facebook', field=models.URLField(blank=True, default='', max_length=250)),
        migrations.AddField(model_name='usuario', name='linkedin', field=models.URLField(blank=True, default='', max_length=250)),
    ]
