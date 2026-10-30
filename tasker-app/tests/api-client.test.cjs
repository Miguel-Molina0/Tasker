require('./load-ts.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createApiClient,ApiError}=require('../src/api-client.ts');
function fixture(fetcher){let tokens=null;const storage={read:async()=>tokens,write:async t=>{tokens=t;}};return createApiClient('http://127.0.0.1:8000/api/',storage,fetcher);}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('JWT é enviado apenas nos endpoints autenticados',async()=>{
 const calls=[];const api=fixture(async(url,options)=>{calls.push({url,options});return url.endsWith('token/')?response({access:'a',refresh:'r'}):response({ok:true});});
 await api.login('email','password');await api.request('usuarios/me/');await api.request('config/','GET',undefined,false);
 assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[1].options.headers.Authorization,'Bearer a');assert.equal(calls[2].options.headers.Authorization,undefined);
});
test('Erros de validação do backend ficam legíveis',async()=>{
 const api=fixture(async()=>response({nr_cpf:['CPF já cadastrado.']},400));
 await assert.rejects(()=>api.request('usuarios/','POST',{}),/nr_cpf: CPF já cadastrado/);
});
test('401 simultâneos compartilham uma renovação e repetem somente após autenticar',async()=>{
 let refreshes=0;const api=fixture(async(url,opt)=>{
  if(url.endsWith('token/'))return response({access:'old',refresh:'refresh'});
  if(url.endsWith('token/refresh/')){refreshes++;await new Promise(r=>setTimeout(r,10));return response({access:'new'});}
  return opt.headers.Authorization==='Bearer new'?response({ok:true}):response({},401);
 });
 await api.login('email','password');await Promise.all([api.request('usuarios/me/'),api.request('pagamentos/')]);assert.equal(refreshes,1);
});
test('Timeout/falha de rede em mutação não provoca reenvio automático',async()=>{
 let calls=0;const api=fixture(async()=>{calls++;throw new Error('network');});
 await assert.rejects(()=>api.request('contratacoes/','POST',{}),/atualize a lista/);assert.equal(calls,1);
});
test('Logout durante uma resposta não restaura a sessão anterior',async()=>{
 let release;const api=fixture(async(url)=>url.endsWith('token/')?response({access:'a',refresh:'r'}):new Promise(r=>{release=()=>r(response({email:'old'}));}));
 await api.login('email','password');const pending=api.request('usuarios/me/');await new Promise(r=>setTimeout(r,0));await api.logout();release();
 await assert.rejects(()=>pending,/sessão foi alterada/);assert.equal(await api.restore(),null);
});
test('Refresh rejeitado limpa credenciais e informa sessão expirada',async()=>{
 let expired=0;const api=fixture(async(url)=>url.endsWith('token/')?response({access:'a',refresh:'r'}):response({},401));
 api.onUnauthorized(()=>expired++);await api.login('email','password');await assert.rejects(()=>api.request('usuarios/me/'),/sessão expirou/);assert.equal(await api.restore(),null);assert.equal(expired,1);
});
