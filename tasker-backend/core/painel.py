"""Painel administrativo Tasker: usa os mesmos modelos e banco do aplicativo."""
import csv
from datetime import timedelta
from decimal import Decimal
from functools import wraps

from django.contrib import messages
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.contenttypes.models import ContentType
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Anuncio, Avaliacao, Contratacao, Pagamento, Protocolo, Usuario


def _staff(view):
    @wraps(view)
    @login_required(login_url='painel_login')
    def check(request, *args, **kwargs):
        if not request.user.is_active or not request.user.is_staff:
            return HttpResponseForbidden('Acesso exclusivo a administradores do Tasker.')
        return view(request, *args, **kwargs)
    return check


def _log(request, obj, detail):
    LogEntry.objects.log_actions(user_id=request.user.pk, queryset=[obj], action_flag=CHANGE, change_message=detail)


def painel_login(request):
    if request.user.is_authenticated and request.user.is_staff and request.user.is_active:
        return redirect('painel_inicio')
    error = None
    if request.method == 'POST':
        identifier = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        user = authenticate(request, username=identifier, password=password)
        if user and user.is_active and user.is_staff:
            login(request, user)
            return redirect('painel_inicio')
        error = 'Credenciais inválidas ou usuário sem permissão administrativa.'
    return render(request, 'painel/login.html', {'error': error})


@_staff
@require_POST
def painel_sair(request):
    logout(request)
    return redirect('painel_login')


def _page(request, base, queryset, per_page=20):
    return Paginator(queryset, per_page).get_page(request.GET.get('page'))


def _context(request, section, title, **kwargs):
    data = {'section':section, 'title':title, 'total_usuarios':Usuario.objects.count(),
            'protocolo_abertos':Protocolo.objects.filter(estado='aberto').count()}
    data.update(kwargs)
    return data


@_staff
def painel_inicio(request):
    users = Usuario.objects.count()
    works = Contratacao.objects.count()
    payments = Pagamento.objects.count()
    total = Pagamento.objects.filter(st_pagamento='liberado').aggregate(v=Sum('vl_servico'))['v'] or Decimal('0')
    last30 = timezone.now() - timedelta(days=30)
    summary = {
        'usuarios': users, 'autonomos': Usuario.objects.filter(id_tp_perfil='autonomo').count(),
        'contratacoes': works, 'pendentes': Contratacao.objects.filter(st_status='PENDENTE').count(),
        'pagamentos': payments, 'total_liberado': total,
        'novos_usuarios': Usuario.objects.filter(date_joined__gte=last30).count(),
        'anuncios': Anuncio.objects.count(),
    }
    recentes = Contratacao.objects.select_related('fk_id_cliente','fk_id_anuncio','fk_id_anuncio__fk_id_usuario').order_by('-dt_criacao')[:8]
    pagamentos = Pagamento.objects.select_related('fk_id_contratacao').order_by('-id')[:7]
    statuses = list(Contratacao.objects.values('st_status').annotate(total=Count('id')).order_by('-total'))
    return render(request, 'painel/index.html', _context(request,'inicio','Visão geral',summary=summary,
                        recentes=recentes,pagamentos=pagamentos,statuses=statuses))


@_staff
def painel_usuarios(request):
    query = request.GET.get('q','').strip()
    tipo = request.GET.get('tipo','')
    qs = Usuario.objects.order_by('-date_joined')
    if query:
        qs = qs.filter(Q(username__icontains=query)|Q(email__icontains=query)|Q(first_name__icontains=query)|Q(last_name__icontains=query)|Q(nm_cidade__icontains=query))
    if tipo in ('autonomo','contratante'): qs = qs.filter(id_tp_perfil=tipo)
    return render(request,'painel/index.html',_context(request,'usuarios','Usuários',page=_page(request,'usuarios',qs),q=query,tipo=tipo))


@_staff
@require_POST
def painel_usuario_status(request,pk):
    obj = get_object_or_404(Usuario,pk=pk)
    if obj.pk == request.user.pk or obj.is_superuser or obj.is_staff:
        messages.error(request,'Não é permitido alterar o acesso de um administrador.')
        return redirect('painel_usuarios')
    with transaction.atomic():
        obj.is_active = not obj.is_active
        obj.save(update_fields=['is_active'])
        _log(request,obj,'Ativação administrativa' if obj.is_active else 'Suspensão administrativa')
    messages.success(request,'Acesso do usuário atualizado.')
    return redirect('painel_usuarios')


@_staff
def painel_anuncios(request):
    q=request.GET.get('q','').strip()
    qs=Anuncio.objects.select_related('fk_id_usuario','fk_id_categoria').order_by('-dt_criacao_anuncio')
    if q: qs=qs.filter(Q(nm_titulo__icontains=q)|Q(fk_id_usuario__username__icontains=q)|Q(nm_area_atendimento__icontains=q))
    return render(request,'painel/index.html',_context(request,'anuncios','Anúncios',page=_page(request,'anuncios',qs),q=q))


@_staff
@require_POST
def painel_anuncio_status(request,pk):
    obj=get_object_or_404(Anuncio,pk=pk)
    with transaction.atomic():
        obj.st_anuncio=not obj.st_anuncio
        obj.save(update_fields=['st_anuncio'])
        _log(request,obj,'Anúncio ativado' if obj.st_anuncio else 'Anúncio desativado')
    messages.success(request,'Situação do anúncio atualizada.')
    return redirect('painel_anuncios')


@_staff
def painel_contratacoes(request):
    q=request.GET.get('q','').strip()
    status=request.GET.get('status','')
    qs=Contratacao.objects.select_related('fk_id_cliente','fk_id_anuncio','fk_id_anuncio__fk_id_usuario').order_by('-dt_criacao')
    if q: qs=qs.filter(Q(fk_id_cliente__username__icontains=q)|Q(fk_id_anuncio__nm_titulo__icontains=q))
    if status in dict(Contratacao.STATUS_CHOICES): qs=qs.filter(st_status=status)
    return render(request,'painel/index.html',_context(request,'contratacoes','Contratações',page=_page(request,'contratacoes',qs),q=q,status=status,choices=Contratacao.STATUS_CHOICES))


@_staff
def painel_pagamentos(request):
    status=request.GET.get('status','')
    qs=Pagamento.objects.select_related('fk_id_contratacao','fk_id_contratacao__fk_id_cliente','fk_id_contratacao__fk_id_anuncio').order_by('-id')
    if status in dict(Pagamento.STATUS_PAGAMENTO): qs=qs.filter(st_pagamento=status)
    return render(request,'painel/index.html',_context(request,'pagamentos','Pagamentos',page=_page(request,'pagamentos',qs),status=status,choices=Pagamento.STATUS_PAGAMENTO))


@_staff
def painel_suporte(request):
    estado=request.GET.get('estado','')
    qs=Protocolo.objects.select_related('usuario','alvo').order_by('-criado')
    if estado in ('aberto','respondido','encerrado'): qs=qs.filter(estado=estado)
    return render(request,'painel/index.html',_context(request,'suporte','Central de suporte',page=_page(request,'suporte',qs),estado=estado))


@_staff
@require_POST
def painel_protocolo_responder(request,pk):
    obj=get_object_or_404(Protocolo,pk=pk)
    reply=request.POST.get('resposta','').strip()
    state=request.POST.get('estado','respondido')
    if state not in ('aberto','respondido','encerrado') or len(reply)>4000:
        messages.error(request,'Dados da resposta inválidos.')
        return redirect('painel_suporte')
    if not reply and state=='respondido':
        messages.error(request,'Informe uma resposta antes de marcar como respondido.')
        return redirect('painel_suporte')
    with transaction.atomic():
        obj.resposta=reply
        obj.estado=state
        obj.save(update_fields=['resposta','estado'])
        _log(request,obj,'Atualização do protocolo de suporte')
    messages.success(request,'Protocolo atualizado.')
    return redirect('painel_suporte')


@_staff
def painel_relatorios(request):
    users=list(Usuario.objects.values('id_tp_perfil').annotate(total=Count('pk')).order_by('-total'))
    orders=list(Contratacao.objects.values('st_status').annotate(total=Count('pk')).order_by('-total'))
    pays=list(Pagamento.objects.values('st_pagamento').annotate(total=Count('pk'),valor=Sum('vl_servico')).order_by('-total'))
    return render(request,'painel/index.html',_context(request,'relatorios','Relatórios',users=users,orders=orders,pays=pays))


@_staff
def painel_exportar(request):
    kind=request.GET.get('tipo','')
    response=HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition']=f'attachment; filename="tasker-{kind}.csv"'
    response.write('\ufeff')
    writer=csv.writer(response, delimiter=';')
    if kind=='usuarios':
        writer.writerow(['ID','Usuário','E-mail','Tipo','Cidade','Ativo','Cadastro'])
        for u in Usuario.objects.order_by('pk').iterator():
            writer.writerow([u.pk,u.username,u.email,u.id_tp_perfil,u.nm_cidade,'Sim' if u.is_active else 'Não',u.date_joined.isoformat()])
    elif kind=='contratacoes':
        writer.writerow(['ID','Cliente','Anúncio','Status','Criado'])
        for c in Contratacao.objects.select_related('fk_id_cliente','fk_id_anuncio').order_by('pk').iterator():
            writer.writerow([c.pk,c.fk_id_cliente.username,c.fk_id_anuncio.nm_titulo,c.st_status,c.dt_criacao.isoformat()])
    elif kind=='pagamentos':
        writer.writerow(['ID','Contrato','Valor','Status','Asaas pagamento'])
        for p in Pagamento.objects.order_by('pk').iterator():
            writer.writerow([p.pk,p.fk_id_contratacao_id,str(p.vl_servico),p.st_pagamento,p.asaas_payment_id or ''])
    else:
        return HttpResponse('Tipo inválido',status=400)
    return response
