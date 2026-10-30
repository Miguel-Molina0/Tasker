import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, Text, View } from 'react-native';
import { Action, State, User } from './domain';
import { api } from './api';
import { applyRemoteAction, emptyState, loadSnapshot, PaymentMode } from './remote';
import { dark, light } from './theme';
<<<<<<< HEAD
type Registration = {name:string;email:string;password:string;phone:string;cpf?:string;cnpj?:string;birth:string;city:string;role:User['role']};
=======
<<<<<<< HEAD
type Registration = {name:string;email:string;password:string;phone:string;cpf:string;birth:string;city:string;role:User['role']};
=======
type Registration = {name:string;email:string;password:string;phone:string;cpf?:string;cnpj?:string;birth:string;city:string;role:User['role']};
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
type Store = {
  state:State; user:User|undefined; ready:boolean; busy:boolean; mode:PaymentMode; connectionError:string;
  act(a:Action):Promise<string|void>; run(fn:()=>unknown|Promise<unknown>,success?:string):Promise<boolean>;
  tell(message:string):void; reset():Promise<void>; sync():Promise<void>;
  login(email:string,password:string):Promise<void>; register(data:Registration):Promise<void>;
  changePassword(current:string,password:string):Promise<void>;
};
const Context=createContext<Store|null>(null);
export function StoreProvider({children}:{children:React.ReactNode}) {
  const [state,setState]=useState<State>(()=>emptyState()),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),
    [mode,setMode]=useState<PaymentMode>('mock'),[connectionError,setConnectionError]=useState(''),[message,setMessage]=useState('');
  const ref=useRef(state),generation=useRef(0),flight=useRef<Promise<void>|null>(null),busyRef=useRef(false),alive=useRef(true);
  const colors=state.theme==='dark'?dark:light;
  function commit(next:State) { ref.current=next; if(alive.current) setState(next); }
  async function sync() {
    if(flight.current) return flight.current;
    const version=generation.current;
    const promise=(async()=>{
      try {
        const session=await api.restore();
        const snapshot=await loadSnapshot(api,!!session,ref.current.theme);
        if(version!==generation.current || !alive.current) return;
        commit(snapshot.state);setMode(snapshot.mode);setConnectionError('');
      } catch(e) {
        if(alive.current && version===generation.current) setConnectionError(e instanceof Error?e.message:'Servidor indisponível.');
        throw e;
      }
    })();
    flight.current=promise;
    try { await promise; } finally { if(flight.current===promise) flight.current=null; }
  }
  async function refreshAfterSave() {
    try { await sync(); } catch { setMessage('A operação foi registrada no servidor, mas não foi possível atualizar a tela. Toque em Atualizar antes de repetir.'); }
  }
  async function login(email:string,password:string) {
    await api.login(email.trim(),password);
    generation.current++; flight.current=null;
    commit(emptyState(ref.current.theme));
    await sync();
  }
  async function register(data:Registration) {
    await api.request('usuarios/','POST',{username:data.email.toLowerCase(),email:data.email.toLowerCase(),password:data.password,
<<<<<<< HEAD
      first_name:data.name,nr_telefone:data.phone,...(data.role==='profissional' ? {nr_cnpj:(data.cnpj||'').replace(/\D/g,'')} : {nr_cpf:(data.cpf||'').replace(/\D/g,'')}),dt_nascimento:data.birth,nm_cidade:data.city,
=======
<<<<<<< HEAD
      first_name:data.name,nr_telefone:data.phone,nr_cpf:data.cpf.replace(/\D/g,''),dt_nascimento:data.birth,nm_cidade:data.city,
=======
      first_name:data.name,nr_telefone:data.phone,...(data.role==='profissional' ? {nr_cnpj:(data.cnpj||'').replace(/\D/g,'')} : {nr_cpf:(data.cpf||'').replace(/\D/g,'')}),dt_nascimento:data.birth,nm_cidade:data.city,
>>>>>>> 1acdd66 (backend atualizado)
>>>>>>> 5e662bf (backend atualizado)
      id_tp_perfil:data.role==='profissional'?'autonomo':'contratante'},false);
    try { await login(data.email,data.password); }
    catch { throw new Error('Conta criada no servidor. Faça login; não repita o cadastro.'); }
  }
  async function changePassword(current:string,password:string) {
    await api.request('usuarios/alterar-senha/','POST',{senha_atual:current,nova_senha:password});
    await api.logout();generation.current++;flight.current=null;commit(emptyState(ref.current.theme));
    await refreshAfterSave();
  }
  async function act(a:Action):Promise<string|void> {
    if(a.type==='theme') { commit({...ref.current,theme:a.theme});await AsyncStorage.setItem('tasker-theme',a.theme);return; }
    const result=await applyRemoteAction(api,ref.current,a);
    if(a.type==='logout'||a.type==='deleteAccount') {
      generation.current++;flight.current=null;commit(emptyState(ref.current.theme));
      await refreshAfterSave();return result;
    }
    await refreshAfterSave();return result;
  }
  async function run(fn:()=>unknown|Promise<unknown>,success?:string) {
    if(busyRef.current) return false;
    busyRef.current=true;setBusy(true);
    try { await fn();if(success) setMessage(success);return true; }
    catch(e) { setMessage(e instanceof Error?e.message:'Não foi possível concluir.');return false; }
    finally { busyRef.current=false;setBusy(false); }
  }
  async function reset() { await act({type:'logout'}); }
  useEffect(()=>{
    alive.current=true;
    api.onUnauthorized(()=>{generation.current++;commit(emptyState(ref.current.theme));setConnectionError('Sessão expirada. Entre novamente.');});
    AsyncStorage.getItem('tasker-theme').then(value=>{
      if(value==='light'||value==='dark') commit({...ref.current,theme:value});
    }).catch(()=>{}).finally(()=>{sync().catch(()=>{}).finally(()=>{if(alive.current) setReady(true);});});
    const timer=setInterval(()=>{if(AppState.currentState==='active'&&!busyRef.current) void sync().catch(()=>{});},8000);
    const subscription=AppState.addEventListener('change',value=>{if(value==='active') void sync().catch(()=>{});});
    return ()=>{alive.current=false;clearInterval(timer);subscription.remove();};
  },[]);
  return (
    <Context.Provider
      value={{
        state,
        user: state.users.find((u) => u.id === state.current),
        act,
        run,
        tell: setMessage,
        reset,
        ready, busy, mode, connectionError, sync, login, register, changePassword,
      }}
    >
      {ready ? (
        children
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.text, marginTop: 16 }}>Abrindo Tasker…</Text>
        </View>
      )}
      {busy && <View style={{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'#0005',alignItems:'center',justifyContent:'center'}}>
        <ActivityIndicator size="large" color={colors.accent}/>
      </View>}
      <Modal
        transparent
        visible={!!message}
        animationType="fade"
        onRequestClose={() => setMessage("")}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000a",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              padding: 24,
              borderRadius: 22,
              maxWidth: 440,
              width: "100%",
              alignSelf: "center",
              gap: 20,
            }}
          >
            <Text
              accessibilityRole="alert"
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: colors.text,
              }}
            >
              {message}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMessage("")}
              style={{
                backgroundColor: colors.primary,
                overflow: "hidden",
                padding: 15,
                borderRadius: 14,
                alignItems: "center",
              }}
            >
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: "none",
                }}
              />
              <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider ausente");
  return value;
}
