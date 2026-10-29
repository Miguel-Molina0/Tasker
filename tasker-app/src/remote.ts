import { ApiClient } from './api-client';
import { Action, Ad, Contract, Message, Payment, State, User, validateSchedule, minutes, wallet } from './domain';
export type PaymentMode = 'mock' | 'asaas';
export function emptyState(theme: State['theme']='dark'): State {
  return {version:1,current:null,theme,users:[],ads:[],contracts:[],events:[],reviews:[],messages:[],notices:[],tickets:[],favorites:{},blocked:{},withdrawals:[]};
}
export const userFromApi=(u:any):User => ({id:String(u.id),name:u.first_name || u.username,email:u.email || '',
  role:u.id_tp_perfil==='autonomo' ? 'profissional' : 'cliente',bio:u.ds_biografia || '',city:u.nm_cidade || '',phone:u.nr_telefone || '',avatar:u.tp_foto || undefined,
  username:u.username});
function endTime(time:string,duration:number) {
  const end=minutes(time)+duration;
  if(end>=1440) throw new Error('O serviço deve terminar antes da meia-noite.');
  return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;
}
export async function listAll(api:ApiClient,path:string):Promise<any[]> {
  let next:string|null=path;
  const result:any[]=[];
  const visited=new Set<string>();
  while(next) {
    if(visited.has(next)) throw new Error('Paginação inválida do servidor.');
    visited.add(next);
    const page:any=await api.request(next,'GET',undefined, !['anuncios/','perfis/','categorias/','avaliacao/'].some(p=>path.startsWith(p)));
    if(Array.isArray(page)) return [...result,...page];
    if(!Array.isArray(page?.results)) throw new Error('Resposta de listagem inválida.');
    result.push(...page.results);
    if(page.next && !page.next.startsWith(api.baseUrl)) throw new Error('Paginação fora do endereço da API.');
    next=page.next ? page.next.slice(api.baseUrl.length) : null;
  }
  return result;
}
export function contractFromApi(c:any, ads:Ad[],payments:any[]):Contract {
  const payment=payments.find(p=>String(p.fk_id_contratacao)===String(c.id));
  const ad=ads.find(a=>a.id===String(c.fk_id_anuncio));
  const paymentMap:Record<string,Payment>={aguardando:'nao_pago',retido:'retido',liberado:'liberado',bloqueado:'bloqueado',processando:'processando'};
  const pay:Payment=payment?.dt_estorno ? 'reembolsado' : paymentMap[payment?.st_pagamento] || 'nao_pago';
  const map:Record<string,Contract['status']>={PENDENTE:'pendente',RECUSADO:'recusada',CANCELADO:'cancelada',CONCLUIDO:'concluida'};
  const status=c.contestado ? 'contestada' : map[c.st_status] || ((c.concluido_cliente || c.concluido_prestador) ? 'aguardando_confirmacao' : 'em_andamento');
  return {id:String(c.id),client:String(c.fk_id_cliente),provider:String(c.prestador_id),ad:String(c.fk_id_anuncio),
    title:c.anuncio_titulo || ad?.title || 'Serviço',description:c.ds_solicitacao || '',address:c.nm_endereco || '',date:c.dt_agendamento || '',
    time:(c.hr_inicio || '').slice(0,5),duration:Math.max(0,minutes(c.hr_final||'00:00')-minutes(c.hr_inicio||'00:00')),
    price:Number(payment?.vl_servico ?? ad?.price ?? 0),status,payment:pay,change:c.proposta_reagendamento || undefined,
    confirmedClient:!!c.concluido_cliente,confirmedProvider:!!c.concluido_prestador,
    reason:c.motivo_contestacao || undefined, method:payment?.asaas_payment_id?.startsWith('mock_') ? 'Simulado pelo backend' : 'Pix',
    paymentId:payment ? String(payment.id) : undefined,pixCode:payment?.pix_copia_cola || undefined,pixImage:payment?.pix_qr_code || undefined};
}
export function messageFromApi(m:any,contracts:Contract[]):Message {
  const c=contracts.find(c=>c.id===String(m.fk_id_contratacao));
  const from=String(m.remetente);
  return {id:String(m.id),from,to:m.destinatario ? String(m.destinatario) : (c ? (from===c.client ? c.provider : c.client) : ''),
    text:m.ds_mensagem,created:m.dt_envio,read:!!m.lida};
}
export async function loadSnapshot(api:ApiClient,authenticated:boolean,theme:State['theme']) {
  const [profiles,rawAds,categories,reviews,config] = await Promise.all([
    listAll(api,'perfis/'),listAll(api,'anuncios/?page_size=50'),listAll(api,'categorias/'),listAll(api,'avaliacao/'),api.request<{payments_mode:PaymentMode}>('config/','GET',undefined,false),
  ]);
  const state=emptyState(theme);
  state.users=profiles.map(userFromApi);
  state.ads=rawAds.map(a=>({id:String(a.id),provider:String(a.fk_id_usuario),title:a.nm_titulo,description:a.nm_descricao,
    category:categories.find(c=>c.id===a.fk_id_categoria)?.nm_categoria || 'Serviços',price:Number(a.vl_preco),city:a.nm_area_atendimento,
    published:a.st_anuncio,images:a.imagens || [],days:a.dias_atendimento?.length ? a.dias_atendimento : [0,1,2,3,4,5,6]}));
  state.reviews=reviews.map(r=>({id:String(r.id),contract:String(r.fk_id_contratacao),from:String(r.avaliador),to:String(r.avaliado),stars:r.nr_nota,text:r.ds_comentario||''}));
  if(authenticated) {
    const [me,contracts,payments,events,messages,favorites,blocks,notices,tickets,calendar] = await Promise.all([
      api.request('usuarios/me/'),listAll(api,'contratacoes/'),listAll(api,'pagamentos/'),listAll(api,'compromissos/'),
      listAll(api,'mensagens/'),listAll(api,'favoritos/'),listAll(api,'bloqueios/'),listAll(api,'notificacoes/'),listAll(api,'suporte/'),listAll(api,'calendarios/'),
    ]);
    const user=userFromApi(me);state.current=user.id;state.users=state.users.filter(u=>u.id!==user.id).concat(user);
    state.contracts=contracts.map(c=>contractFromApi(c,state.ads,payments));
    state.events=events.map(e=>({id:String(e.id),user:user.id,title:e.titulo,date:e.data,time:e.hora.slice(0,5),duration:e.duracao,note:e.observacoes||''}));
    state.messages=messages.map(m=>messageFromApi(m,state.contracts));
    state.favorites[user.id]=favorites.map(f=>String(f.anuncio));state.blocked[user.id]=blocks.map(b=>String(b.bloqueado));
    state.notices=notices.map(n=>({id:String(n.id),user:user.id,text:n.texto,route:n.rota,target:n.alvo || undefined,read:n.lida}));
    state.tickets=tickets.map(t=>({id:String(t.id),user:user.id,subject:t.assunto,text:t.texto,target:t.alvo?String(t.alvo):undefined,created:t.criado,status:t.estado,response:t.resposta}));
    state.calendar=calendar.map(e=>({id:String(e.id),contract:String(e.fk_id_contratacao),date:e.dt_agendamento,time:e.hr_inicio.slice(0,5),status:e.st_agendamento}));
  }
  return {state,mode:config.payments_mode};
}
export async function applyRemoteAction(api:ApiClient,state:State,a:Action):Promise<string|void> {
  switch(a.type) {
    case 'login': throw new Error('Entre com email e senha. Troca de conta sem senha foi removida.');
    case 'register': throw new Error('Use o formulário de cadastro.');
    case 'logout': return api.logout();
    case 'deleteAccount': await api.request('usuarios/excluir-conta/','DELETE');return api.logout();
    case 'profile': {
      if(a.patch.passwordHash) throw new Error('Use a tela Alterar senha.');
      const body:any={};
      if(a.patch.name!==undefined) body.first_name=a.patch.name;
      if(a.patch.bio!==undefined) body.ds_biografia=a.patch.bio;
      if(a.patch.city!==undefined) body.nm_cidade=a.patch.city;
      if(a.patch.phone!==undefined) body.nr_telefone=a.patch.phone;
      if(a.patch.avatar?.startsWith('data:')) body.tp_foto=a.patch.avatar;
      await api.request('usuarios/me/','PATCH',body);return;
    }
    case 'favorite': {
      const rows=await listAll(api,'favoritos/');const old=rows.find(r=>String(r.anuncio)===a.id);
      await api.request(old ? `favoritos/${old.id}/` : 'favoritos/',old ? 'DELETE' : 'POST',old ? undefined : {anuncio:Number(a.id)});return;
    }
    case 'block': {
      const rows=await listAll(api,'bloqueios/');const old=rows.find(r=>String(r.bloqueado)===a.id);
      await api.request(old ? `bloqueios/${old.id}/` : 'bloqueios/',old ? 'DELETE' : 'POST',old ? undefined : {bloqueado:Number(a.id)});return;
    }
    case 'ad': {
      const ad=a.ad;
      if(!ad.title.trim() || !ad.description.trim() || !ad.city.trim() || !ad.days.length || !Number.isFinite(ad.price) || ad.price<=0) throw new Error('Preencha título, descrição, cidade, preço e dias.');
      const categories=await listAll(api,'categorias/');
      const category=categories.find(c=>c.nm_categoria===ad.category);
      if(!category) throw new Error('Categoria não cadastrada no servidor. Cadastre-a no admin.');
      const exists=state.ads.some(old=>old.id===ad.id);
      const result=await api.request(exists ? `anuncios/${ad.id}/` : 'anuncios/',exists ? 'PATCH' : 'POST',{
        nm_titulo:ad.title,nm_descricao:ad.description,vl_preco:ad.price.toFixed(2),nm_area_atendimento:ad.city,
        nm_disponibilidade:'Conforme dias de atendimento',dias_atendimento:ad.days,imagens:ad.images,st_anuncio:ad.published,fk_id_categoria:category.id});
      return String(result.id);
    }
    case 'deleteAd': {
      // Preserve contract history by unpublishing an ad that has already been hired.
      if(state.contracts.some(c=>c.ad===a.id)) await api.request(`anuncios/${a.id}/`,'PATCH',{st_anuncio:false});
      else await api.request(`anuncios/${a.id}/`,'DELETE');
      return;
    }
    case 'request': {
      const c=a.contract;
      validateSchedule(c.date,c.time,c.duration);
      if(!c.description.trim()||!c.address.trim()) throw new Error('Informe escopo e endereço ou link do atendimento.');
      const result=await api.request('contratacoes/','POST',{fk_id_anuncio:Number(c.ad),dt_agendamento:c.date,hr_inicio:c.time,
        hr_final:endTime(c.time,c.duration),ds_solicitacao:c.description,nm_endereco:c.address,chave_solicitacao:c.id});
      return String(result.id);
    }
    case 'transition': {
      const routes:Record<string,string>={accept:'aceitar',decline:'recusar',finish:'concluir',confirm:'concluir',cancel:'cancelar',dispute:'contestar'};
      if(a.event==='pay') throw new Error('O pagamento é confirmado pelo backend ou webhook. Use Atualizar na tela de pagamento.');
      await api.request(`contratacoes/${a.id}/${routes[a.event]}/`,'PATCH',a.event==='dispute' ? {motivo:a.reason} : {});return;
    }
    case 'reschedule': await api.request(`contratacoes/${a.id}/reagendar/`,'PATCH',{data:a.date,hora:a.time});return;
    case 'answerChange': await api.request(`contratacoes/${a.id}/responder-reagendamento/`,'PATCH',{aceitar:a.accept});return;
    case 'event': {
      const e=a.event;const exists=state.events.some(old=>old.id===e.id);
      const result=await api.request(exists ? `compromissos/${e.id}/`:'compromissos/',exists?'PATCH':'POST',{
        titulo:e.title,data:e.date,hora:e.time,duracao:e.duration,observacoes:e.note});return String(result.id);
    }
    case 'deleteEvent': await api.request(`compromissos/${a.id}/`,'DELETE');return;
    case 'review': {
      if(!Number.isInteger(a.review.stars)||a.review.stars<1||a.review.stars>5) throw new Error('Escolha de 1 a 5 estrelas.');
      const result=await api.request('avaliacao/','POST',{fk_id_contratacao:Number(a.review.contract),nr_nota:a.review.stars,ds_comentario:a.review.text});return String(result.id);
    }
    case 'message': {
      const result=await api.request('mensagens/','POST',{destinatario:Number(a.to),ds_mensagem:a.text.trim()});return String(result.id);
    }
    case 'deleteMessage': await api.request(`mensagens/${a.id}/`,'DELETE');return;
    case 'readMessages': await api.request('mensagens/ler/','POST',{remetente:Number(a.from)});return;
    case 'readNotice': await api.request('notificacoes/ler/','POST',a.id ? {id:Number(a.id)} : {});return;
    case 'ticket': {
      const result=await api.request('suporte/','POST',{assunto:a.ticket.subject,texto:a.ticket.text,alvo:a.ticket.target ? Number(a.ticket.target):null});return String(result.id);
    }
    case 'withdraw': throw new Error('O repasse é gerenciado pelo servidor. Um repasse liberado já foi enviado ao destino; não existe segundo saque pelo aplicativo.');
    case 'theme': return;
  }
}
