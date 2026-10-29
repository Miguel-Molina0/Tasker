from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from core.models import Usuario, Categoria, Anuncio
from pathlib import Path
import base64

class Command(BaseCommand):
    help='Cria contas e anúncios de demonstração no backend local. Não altera contas existentes.'
    def handle(self,*args,**kwargs):
        if not settings.DEBUG or settings.PAYMENTS_MODE!='mock': raise CommandError('Permitido apenas em DEBUG e PAYMENTS_MODE=mock.')
        profiles=[('cliente','cliente@teste.com','Ana Paula','contratante','Mongaguá','cliente'),
            ('pedro','prestador@teste.com','Pedro Carvalho','autonomo','Mongaguá','pedro'),
            ('joao','joao@teste.com','João Santos','autonomo','Praia Grande','joao'),
            ('marina','marina@teste.com','Marina Oliveira','autonomo','Mongaguá','marina'),
            ('bia','bia@teste.com','Beatriz Lima','autonomo','Itanhaém','bia')]
        # Bundled images keep the seed independent of external image hosts.
        assets=Path(settings.BASE_DIR).parent/'tasker-app'/'assets'/'images'
        from django.core.files.base import ContentFile
        for username,email,name,role,city,photo in profiles:
            user,created=Usuario.objects.get_or_create(username=username,defaults={'email':email,'first_name':name,'id_tp_perfil':role,'nm_cidade':city,'nr_telefone':'13999990001','ds_biografia':'Perfil de demonstração Tasker.'})
            if created:
                user.set_password('Tasker@123')
                path=assets/'profiles'/f'{photo}.jpg'
                if path.exists(): user.tp_foto.save(f'demo-{photo}.jpg',ContentFile(path.read_bytes()),save=False)
                user.save()
        for name in ['Design','Elétrica','Limpeza','Beleza','Reformas','Tecnologia']: Categoria.objects.get_or_create(nm_categoria=name)
        ads=[('pedro','Design','Sua ideia, um aplicativo de verdade','Prototipação de até 5 telas. Combine o escopo pelo chat.',280,'design'),
            ('joao','Elétrica','Reparos elétricos com cuidado','Visita para diagnóstico e troca de até duas tomadas.',150,'eletrica'),
            ('marina','Limpeza','Uma casa limpa, mais tempo para você','Limpeza e organização residencial com horário combinado.',180,'limpeza'),
            ('bia','Beleza','Um novo cuidado para o seu cabelo','Corte e finalização com atendimento individual.',90,'beleza')]
        for username,category,title,description,price,image in ads:
            provider=Usuario.objects.get(username=username)
            path=assets/'services'/f'{image}.jpg'
            images=['data:image/jpeg;base64,'+base64.b64encode(path.read_bytes()).decode()] if path.exists() else []
            Anuncio.objects.get_or_create(fk_id_usuario=provider,nm_titulo=title,defaults={'nm_descricao':description,'vl_preco':price,'nm_area_atendimento':provider.nm_cidade,'nm_disponibilidade':'Segunda a sábado','dias_atendimento':[1,2,3,4,5,6],'imagens':images,'fk_id_categoria':Categoria.objects.get(nm_categoria=category)})
        self.stdout.write(self.style.SUCCESS('Demo pronta. cliente@teste.com / prestador@teste.com — senha Tasker@123.'))
