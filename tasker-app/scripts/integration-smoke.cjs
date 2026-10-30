// Run with BACKEND_TEST_URL=http://127.0.0.1:8000/api/ against a fresh mock database.
require('../tests/load-ts.cjs');
const assert=require('node:assert/strict');
const {createApiClient}=require('../src/api-client.ts');
const {loadSnapshot,applyRemoteAction}=require('../src/remote.ts');
const {dayAfter}=require('../src/domain.ts');
function client(){let tokens=null;return createApiClient(process.env.BACKEND_TEST_URL||'http://127.0.0.1:8000/api/',{
 read:async()=>tokens,write:async t=>{tokens=t;}});}
(async()=>{
 const customer=client(),provider=client(),outsider=client();const suffix=Date.now();
 const register=async(api,role)=>{
  const email=`smoke-${role}-${suffix}@test.example`;
  const u=await api.request('usuarios/','POST',{username:email,email,first_name:role,password:'TestingGood!349',id_tp_perfil:role==='provider'?'autonomo':'contratante',nm_cidade:'Mongaguá'},false);
  await api.login(email,'TestingGood!349');return String(u.id);
 };
 const customerId=await register(customer,'customer'),providerId=await register(provider,'provider');await register(outsider,'outsider');
 let {state:ps}=await loadSnapshot(provider,true,'dark');
 const adId=await applyRemoteAction(provider,ps,{type:'ad',ad:{id:'temp',provider:providerId,title:'Teste integrado',description:'Serviço para teste de integração',category:'Design',price:180,city:'Mongaguá',published:true,images:[],days:[0,1,2,3,4,5,6]}});
 let {state:cs}=await loadSnapshot(customer,true,'dark');assert(cs.ads.some(a=>a.id===adId));
 await applyRemoteAction(customer,cs,{type:'favorite',id:adId});
 ({state:cs}=await loadSnapshot(customer,true,'dark'));assert(cs.favorites[customerId].includes(adId));
 assert.equal((await loadSnapshot(outsider,true,'dark')).state.favorites[(await outsider.request('usuarios/me/')).id].length,0);
 await applyRemoteAction(customer,cs,{type:'message',to:providerId,text:'Olá antes da contratação'});
 ({state:ps}=await loadSnapshot(provider,true,'dark'));assert(ps.messages.some(m=>m.from===customerId&&m.to===providerId));
 const contract={id:'request-'+suffix,client:customerId,provider:providerId,ad:adId,title:'Teste integrado',description:'Escopo de teste',address:'Remoto',date:dayAfter(4),time:'10:00',duration:60,price:180,status:'pendente',payment:'nao_pago'};
 const id=await applyRemoteAction(customer,cs,{type:'request',contract});
 assert.equal(await applyRemoteAction(customer,cs,{type:'request',contract}),id);
 ({state:ps}=await loadSnapshot(provider,true,'dark'));assert(ps.contracts.some(c=>c.id===id&&c.address==='Remoto'));
 assert(ps.calendar.some(e=>e.contract===id&&e.status==='PENDENTE'));
 assert.equal((await loadSnapshot(outsider,true,'dark')).state.contracts.length,0);
 await applyRemoteAction(provider,ps,{type:'transition',id,event:'accept'});
 await applyRemoteAction(customer,cs,{type:'reschedule',id,date:dayAfter(4),time:'13:00'});
 await applyRemoteAction(provider,ps,{type:'answerChange',id,accept:true});
 ({state:cs}=await loadSnapshot(customer,true,'dark'));assert.equal(cs.contracts.find(c=>c.id===id).time,'13:00');assert.equal(cs.calendar.find(e=>e.contract===id).time,'13:00');
 await applyRemoteAction(provider,ps,{type:'transition',id,event:'finish'});
 ({state:cs}=await loadSnapshot(customer,true,'dark'));assert.equal(cs.contracts.find(c=>c.id===id).status,'aguardando_confirmacao');
 await applyRemoteAction(customer,cs,{type:'transition',id,event:'confirm'});
 ({state:cs}=await loadSnapshot(customer,true,'dark'));assert.equal(cs.contracts.find(c=>c.id===id).status,'concluida');assert.equal(cs.contracts.find(c=>c.id===id).payment,'liberado');
 await applyRemoteAction(customer,cs,{type:'review',review:{id:'temp',contract:id,from:customerId,to:providerId,stars:5,text:'Integração validada'}});
 await applyRemoteAction(customer,cs,{type:'ticket',ticket:{id:'temp',user:customerId,subject:'Teste de suporte',text:'Solicitação de teste integrada',created:new Date().toISOString()}});
 ({state:cs}=await loadSnapshot(customer,true,'dark'));assert(cs.reviews.some(r=>r.contract===id));assert.equal(cs.tickets.length,1);
 await applyRemoteAction(customer,cs,{type:'event',event:{id:'temp',user:customerId,title:'Pessoal',date:dayAfter(5),time:'09:00',duration:60,note:'Teste'}});
 assert.equal((await loadSnapshot(customer,true,'dark')).state.events.length,1);
 console.log('Integração HTTP validada: duas sessões, privacidade, anúncios, favoritos, chat, idempotência, agendas, reagendamento, duas confirmações, repasse mock, avaliação, suporte e compromisso pessoal.');
})().catch(e=>{console.error(e);process.exitCode=1;});
