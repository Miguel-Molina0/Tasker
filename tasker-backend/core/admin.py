from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Categoria, Anuncio, Servico, Contratacao, Pagamento, Calendario, Avaliacao, Mensagem
@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
<<<<<<< HEAD
    fieldsets = UserAdmin.fieldsets + (('Tasker', {'fields':('id_tp_perfil','nr_cpf','nr_cnpj','nr_telefone','ds_biografia','tp_foto','chave_pix','tipo_chave_pix','fcm_token','asaas_customer_id')}),)
=======
<<<<<<< HEAD
    fieldsets = UserAdmin.fieldsets + (('Tasker', {'fields':('id_tp_perfil','nr_cpf','nr_telefone','ds_biografia','tp_foto','chave_pix','tipo_chave_pix','fcm_token','asaas_customer_id')}),)
=======
    fieldsets = UserAdmin.fieldsets + (('Tasker', {'fields':('id_tp_perfil','nr_cpf','nr_cnpj','nr_telefone','ds_biografia','tp_foto','chave_pix','tipo_chave_pix','fcm_token','asaas_customer_id')}),)
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
@admin.register(Pagamento)
class PagamentoAdmin(admin.ModelAdmin):
    list_display = ['id','fk_id_contratacao','vl_servico','st_pagamento','dt_declaracao_pagamento','repasse_tentado']
    readonly_fields = [f.name for f in Pagamento._meta.fields]
    def has_add_permission(self,request): return False
    def has_delete_permission(self,request,obj=None): return False
@admin.register(Contratacao)
class ContratacaoAdmin(admin.ModelAdmin):
    list_display = ['id','fk_id_cliente','fk_id_anuncio','st_status','dt_agendamento']
    readonly_fields = [f.name for f in Contratacao._meta.fields]
    def has_add_permission(self,request): return False
    def has_delete_permission(self,request,obj=None): return False
from .models import Protocolo, Notificacao, CompromissoPessoal, Favorito, Bloqueio
admin.site.register([Categoria, Anuncio, Servico, Calendario, Avaliacao, Mensagem, Protocolo, Notificacao, CompromissoPessoal, Favorito, Bloqueio])
