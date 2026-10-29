import {api} from './api';
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, TextInput, TextInputProps, View } from "react-native";
import { AuthLayout } from "./auth-layout";
import { parseDate, uid, validDate } from "./domain";
import { useStore } from "./store";
import { Button, go, IconName, IconButton, InfoRow, Title, Txt, useColors, } from "./ui";
export const demoPassword = "Tasker@123";
export const hash = (password: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
export function passwordError(value: string) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/.test(value)
        ? ""
        : "Use ao menos 8 caracteres, maiúscula, minúscula, número e símbolo.";
}
export function cpfValid(value: string) {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf))
        return false;
    return [9, 10].every((n) => {
        const sum = cpf
            .slice(0, n)
            .split("")
            .reduce((sum, d, i) => sum + Number(d) * (n + 1 - i), 0);
        const digit = (sum * 10) % 11;
        return (digit === 10 ? 0 : digit) === Number(cpf[n]);
    });
}
export function cnpjValid(value: string) {
    const d = value.replace(/\D/g, '');
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    return [
        [5,4,3,2,9,8,7,6,5,4,3,2],
        [6,5,4,3,2,9,8,7,6,5,4,3,2],
    ].every((weights, offset) => {
        const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
        const digit = (sum * 10) % 11;
        return (digit === 10 ? 0 : digit) === Number(d[12 + offset]);
    });
}
function AuthField({ label, icon, trailingAction, ...props }: TextInputProps & {
    label: string;
    icon: IconName;
    trailingAction?: React.ReactNode;
}) {
    const c = useColors(), [focused, setFocused] = useState(false);
    return (<View style={{ gap: 7 }}>
      <Txt style={{ fontSize: 12, lineHeight: 18, fontWeight: "600" }}>
        {label}
      </Txt>
      <View style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.panel,
            borderWidth: 1,
            borderColor: focused ? c.accent : c.controlLine,
            borderRadius: 18,
            paddingLeft: 15,
            paddingRight: trailingAction ? 4 : 15,
            gap: 10,
        }}>
        <Ionicons name={icon} size={19} color={c.accent} accessible={false}/>
        <TextInput {...props} accessibilityLabel={label} placeholderTextColor={c.muted} selectionColor={c.accent} onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
        }} onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
        }} style={[
            {
                flex: 1,
                minWidth: 0,
                minHeight: 52,
                paddingVertical: 14,
                color: c.text,
                fontSize: 15,
                backgroundColor: "transparent",
            },
            props.style,
        ]}/>
        {trailingAction}
      </View>
    </View>);
}
function AuthLink({ label, onPress, }: {
    label: string;
    onPress: () => void;
}) {
    const c = useColors();
    return (<Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: "center",
            opacity: pressed ? 0.65 : 1,
        })}>
      <Txt style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>
        {label}
      </Txt>
    </Pressable>);
}
function AccountSwitch({ hint, label, onPress, }: {
    hint: string;
    label: string;
    onPress: () => void;
}) {
    return (<View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            columnGap: 6,
        }}>
      <Txt muted style={{ fontSize: 13 }}>{hint}</Txt>
      <AuthLink label={label} onPress={onPress}/>
    </View>);
}
function FormSection({ title, icon, children, }: {
    title: string;
    icon: IconName;
    children: React.ReactNode;
}) {
    const c = useColors();
    return (<View style={{ gap: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{
            width: 32,
            height: 32,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.tint,
        }}>
          <Ionicons name={icon} size={18} color={c.accent} accessible={false}/>
        </View>
        <Txt style={{ fontSize: 16, fontWeight: "700" }}>{title}</Txt>
      </View>
      {children}
    </View>);
}
export function LoginScreen() {
    const { login: authenticate, tell } = useStore(), { next, id } = useLocalSearchParams<{
        next?: string;
        id?: string;
    }>(), c = useColors();
    const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [show, setShow] = useState(false), [showDemo, setShowDemo] = useState(false), [busy, setBusy] = useState(false);
    async function login() {
      if(busy) return;
      setBusy(true);
      try {
        await authenticate(email,password);
        router.replace({pathname:(next?.startsWith('/')&&!next.startsWith('//')?next:'/') as any,params:id?{id}:{}});
      } catch(e) {tell(e instanceof Error?e.message:'Não foi possível entrar.');}
      finally {setBusy(false);}
    }
    return (<AuthLayout mode="login" title="Seu próximo passo começa aqui." subtitle="Encontre talentos. Realize seus projetos.">
      <View style={{ gap: 4 }}>
        <Title>Entrar</Title>
        <Txt muted>Acesse sua conta para continuar.</Txt>
      </View>
      <View style={{ gap: 16 }}>
        <AuthField label="Email" icon="mail-outline" placeholder="seu@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"/>
        <AuthField label="Senha" icon="lock-closed-outline" placeholder="Sua senha" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" onSubmitEditing={() => { if (!busy)
        login(); }} trailingAction={<IconButton name={show ? "eye-off-outline" : "eye-outline"} label={show ? "Ocultar senha" : "Mostrar senha"} onPress={() => setShow(!show)} color={c.muted}/>}/>
      </View>
      <View style={{ alignItems: "flex-end", marginTop: -12 }}>
        <AuthLink label="Esqueci minha senha" onPress={() => go("recuperar-senha")}/>
      </View>
      <Button title={busy ? "Entrando…" : "Entrar"} icon="log-in-outline" disabled={busy} onPress={login}/>
      <AccountSwitch hint="Ainda não tem uma conta?" label="Cadastre-se" onPress={() => go("cadastro")}/>
      <View style={{ height: 1, backgroundColor: c.line }}/>
      <View style={{
            borderRadius: 18,
            backgroundColor: c.panel,
            borderWidth: 1,
            borderColor: c.line,
            overflow: "hidden",
        }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Contas de demonstração" accessibilityState={{ expanded: showDemo }} aria-expanded={showDemo} onPress={() => setShowDemo(!showDemo)} style={({ pressed }) => ({
            padding: 15,
            minHeight: 54,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: pressed ? 0.65 : 1,
        })}>
          <Ionicons name="flask-outline" size={19} color={c.accent} accessible={false}/>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 13, fontWeight: "600" }}>Contas de demonstração</Txt>
          </View>
          <Ionicons name={showDemo ? "chevron-up" : "chevron-down"} size={18} color={c.muted} accessible={false}/>
        </Pressable>
        {showDemo && (<View style={{ padding: 15, paddingTop: 0, gap: 12 }}>
            <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
              Para testar o app, escolha uma conta e toque em Entrar.
              Senha das contas de exemplo: {demoPassword}
            </Txt>
            <View style={{ gap: 8 }}>
              <Button title="Usar cliente" icon="person-outline" secondary onPress={() => {
                setEmail("cliente@teste.com");
                setPassword(demoPassword);
            }}/>
              <Button title="Usar profissional" icon="briefcase-outline" secondary onPress={() => {
                setEmail("prestador@teste.com");
                setPassword(demoPassword);
            }}/>
            </View>
          </View>)}
      </View>
      <View style={{ alignItems: "center" }}>
        <AuthLink label="Continuar explorando" onPress={() => router.replace("/")}/>
      </View>
    </AuthLayout>);
}
export function RegisterScreen() {
    const { register, tell } = useStore(), c = useColors(), [role, setRole] = useState("Cliente"), [name, setName] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState(""), [cpf, setCpf] = useState(""), [cnpj, setCnpj] = useState(""), [birth, setBirth] = useState(""), [city, setCity] = useState("Mongaguá"), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [showPassword, setShowPassword] = useState(false), [showConfirm, setShowConfirm] = useState(false), [terms, setTerms] = useState(false), [busy, setBusy] = useState(false);
    async function save() {
        setBusy(true);
        try {
            if (name.trim().length < 3)
                throw new Error("Informe seu nome.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                throw new Error("Informe um email válido.");
            if (role === "Cliente" && !cpfValid(cpf))
                throw new Error("Informe um CPF válido.");
            if (role !== "Cliente" && !cnpjValid(cnpj))
                throw new Error("Informe um CNPJ válido.");
            if (!/^\d{10,11}$/.test(phone.replace(/\D/g, "")))
                throw new Error("Informe telefone com DDD.");
            const date = parseDate(birth);
            if (!validDate(date))
                throw new Error("Informe sua data de nascimento.");
            const d = new Date(date + "T12:00:00"), today = new Date(), adult = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate(), 23, 59);
            if (d > adult || d.getFullYear() < 1900)
                throw new Error("É necessário ter 18 anos ou mais.");
            if (!city.trim())
                throw new Error("Informe sua cidade.");
            if (passwordError(password))
                throw new Error(passwordError(password));
            if (password !== confirm)
                throw new Error("As senhas precisam ser iguais.");
            if (!terms)
                throw new Error("Leia e aceite os termos da demonstração.");
            await register({name:name.trim(),email:email.trim().toLowerCase(),password,phone,cpf,cnpj,birth:date,city:city.trim(),role:role==='Cliente'?'cliente':'profissional'});
            router.replace('/');
        }
        catch (e) {
            tell(e instanceof Error ? e.message : "Não foi possível cadastrar.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<AuthLayout mode="register" title="Vamos começar." subtitle="Seu talento e seus projetos têm lugar aqui.">
      <View style={{ gap: 4 }}>
        <Title>Criar conta</Title>
        <Txt muted>Como você quer usar o Tasker?</Txt>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
            { label: "Cliente", icon: "person-outline", text: "Encontre serviços" },
            { label: "Profissional", icon: "briefcase-outline", text: "Ofereça seu talento" },
        ].map((item) => {
            const selected = role === item.label;
            return (<Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }} aria-selected={selected} onPress={() => setRole(item.label)} style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    padding: 13,
                    borderRadius: 20,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? c.accent : c.controlLine,
                    backgroundColor: selected ? c.tint : c.panel,
                    opacity: pressed ? 0.7 : 1,
                    gap: 7,
                })}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{
                    width: 38,
                    height: 38,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.card,
                    overflow: "hidden",
                }}>
                  {selected && (<LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}/>)}
                  <Ionicons name={item.icon as IconName} size={20} color={selected ? c.onPrimary : c.accent} accessible={false}/>
                </View>
                <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={20} color={selected ? c.accent : c.muted} accessible={false}/>
              </View>
              <Txt style={{ fontSize: 13, fontWeight: "700" }}>{item.label}</Txt>
              <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>{item.text}</Txt>
            </Pressable>);
        })}
      </View>
      <View style={{ padding: 13, borderRadius: 16, backgroundColor: c.panel }}>
        <InfoRow icon="flask-outline">
          <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
            Seu cadastro será salvo no servidor Tasker.
          </Txt>
        </InfoRow>
      </View>
      <FormSection title="Sobre você" icon="person-circle-outline">
        <AuthField label="Nome completo" icon="person-outline" placeholder="Como você se chama?" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words"/>
        {role === "Cliente" ? <AuthField label="CPF" icon="card-outline" placeholder="000.000.000-00" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14}/> : <AuthField label="CNPJ" icon="card-outline" placeholder="00.000.000/0000-00" value={cnpj} onChangeText={setCnpj} keyboardType="number-pad" maxLength={18}/>}
        <AuthField label="Nascimento (DD/MM/AAAA)" icon="calendar-outline" placeholder="DD/MM/AAAA" value={birth} onChangeText={setBirth} keyboardType="numbers-and-punctuation" maxLength={10}/>
        <Txt muted style={{ fontSize: 12, lineHeight: 18, marginTop: -8 }}>
          Você precisa ter 18 anos ou mais.
        </Txt>
        <AuthField label="Telefone com DDD" icon="call-outline" placeholder="(11) 99999-9999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel"/>
        <AuthField label="Cidade" icon="location-outline" placeholder="Sua cidade" value={city} onChangeText={setCity} autoCapitalize="words"/>
      </FormSection>
      <View style={{ height: 1, backgroundColor: c.line, marginVertical: 4 }}/>
      <FormSection title="Acesso à conta" icon="shield-checkmark-outline">
        <AuthField label="Email" icon="mail-outline" placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"/>
        <AuthField label="Senha" icon="lock-closed-outline" placeholder="Crie uma senha" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" trailingAction={<IconButton name={showPassword ? "eye-off-outline" : "eye-outline"} label={showPassword ? "Ocultar senha" : "Mostrar senha"} onPress={() => setShowPassword(!showPassword)} color={c.muted}/>}/>
        <Txt muted style={{ fontSize: 12, lineHeight: 18, marginTop: -7 }}>
          8 caracteres ou mais, com maiúscula, minúscula, número e símbolo.
        </Txt>
        <AuthField label="Confirmar senha" icon="lock-closed-outline" placeholder="Repita sua senha" value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" trailingAction={<IconButton name={showConfirm ? "eye-off-outline" : "eye-outline"} label={showConfirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} onPress={() => setShowConfirm(!showConfirm)} color={c.muted}/>}/>
      </FormSection>
      <View style={{ gap: 2 }}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Li e aceito os termos da demonstração." accessibilityState={{ checked: terms }} aria-checked={terms} onPress={() => setTerms(!terms)} style={({ pressed }) => ({
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            opacity: pressed ? 0.65 : 1,
        })}>
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: terms ? c.primary : c.controlLine,
            backgroundColor: terms ? c.primary : c.panel,
            alignItems: "center",
            justifyContent: "center",
        }}>
            {terms && <Ionicons name="checkmark" size={17} color={c.onPrimary} accessible={false}/>}
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 13 }}>Li e aceito os termos da demonstração.</Txt>
          </View>
        </Pressable>
        <View style={{ alignItems: "flex-start", paddingLeft: 35 }}>
          <AuthLink label="Ler termos e privacidade" onPress={() => go("termos")}/>
        </View>
      </View>
      <Button title={busy ? "Criando conta…" : "Cadastrar"} icon="person-add-outline" disabled={busy} onPress={save}/>
      <AccountSwitch hint="Já tem uma conta?" label="Entrar" onPress={() => router.replace("/login")}/>
    </AuthLayout>);
}
export function RecoverScreen() {
  const {run,tell}=useStore();
  const params=useLocalSearchParams<{uid?:string;token?:string}>();
  const [email,setEmail]=useState(''),[uidValue,setUid]=useState(params.uid || ''),[token,setToken]=useState(params.token || ''),[password,setPassword]=useState('');
  return <AuthLayout mode="recover" title="Vamos recuperar seu acesso." subtitle="Volte aos seus projetos e próximos serviços.">
    <Title>Recuperar acesso</Title>
    <AuthField label="Email cadastrado" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>
    <Button title="Solicitar recuperação" onPress={async()=>{await run(async()=>{const r=await api.request('usuarios/recuperar-senha/','POST',{email},false);tell(r.status);});}}/>
    <Txt muted>Abra o link recebido por email. Se necessário, copie o identificador e o código do link abaixo.</Txt>
    <AuthField label="Identificador do link (uid)" icon="person-outline" value={uidValue} onChangeText={setUid} autoCapitalize="none"/>
    <AuthField label="Código do link (token)" icon="key-outline" value={token} onChangeText={setToken} autoCapitalize="none"/>
    <AuthField label="Nova senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry/>
    <Button title="Redefinir senha" onPress={async()=>{if(await run(async()=>{await api.request('usuarios/redefinir-senha/','POST',{uid:uidValue,token,password},false);})) {tell('Senha redefinida. Entre novamente.');router.replace('/login');}}}/>
    <Button title="Voltar ao login" secondary onPress={()=>router.replace('/login')}/>
  </AuthLayout>;
}
