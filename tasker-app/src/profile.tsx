import {API_URL} from './api';
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { hash, passwordError } from "./auth";
import { useStore } from "./store";
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, go, InfoRow, MenuItem, Row, Shell, Title, Txt, VisualSteps, } from "./ui";
export function ProfileSettingsScreen() {
    const { user } = useStore();
    const shortcuts: {
        title: string;
        path: string;
        icon: React.ComponentProps<typeof Ionicons>["name"];
    }[] = [
        ...(user?.role === "profissional"
            ? [
                {
                    title: "Meus anúncios",
                    path: "meus-anuncios",
                    icon: "megaphone-outline" as const,
                },
                {
                    title: "Meu desempenho",
                    path: "desempenho",
                    icon: "stats-chart-outline" as const,
                },
            ]
            : []),
        {
            title: "Meus serviços",
            path: "meus-servicos",
            icon: "briefcase-outline",
        },
        { title: "Minha agenda", path: "calendario", icon: "calendar-outline" },
        { title: "Favoritos", path: "favoritos", icon: "heart-outline" },
        {
            title: "Carteira e pagamentos",
            path: "carteira",
            icon: "wallet-outline",
        },
        {
            title: "Notificações",
            path: "notificacoes",
            icon: "notifications-outline",
        },
        {
            title: "Configurações",
            path: "configuracoes",
            icon: "settings-outline",
        },
        { title: "Ajuda e suporte", path: "suporte", icon: "help-buoy-outline" },
    ];
    return (<Shell title="Configurações do perfil" nav>
      <Card>
        <Row>
          <Avatar name={user?.name || "Perfil"} uri={user?.avatar} size={66}/>
          <View style={{ flex: 1 }}>
            <Title>{user?.name}</Title>
            <Txt muted>
              {user?.role === "profissional"
            ? "Profissional autônomo"
            : "Cliente"}{" "}
              · {user?.city}
            </Txt>
          </View>
        </Row>
        <Txt>
          {user?.bio || "Conte um pouco sobre você editando seu perfil."}
        </Txt>
        <Button title="Editar perfil" icon="create-outline" secondary onPress={() => go("editar-perfil")}/>
      </Card>
      <View style={{ gap: 8 }}>
        {shortcuts.map(({ title, path, icon }) => (<MenuItem key={path} title={title} icon={icon} onPress={() => go(path)}/>))}
      </View>
      <Card>
        <Badge text="Apresentação TCC"/>
        <Txt>
          Alterne entre cliente e profissional para demonstrar o mesmo serviço
          nas duas contas.
        </Txt>
        <Button title="Conexão com o servidor" icon="play-circle-outline" onPress={() => go("demonstracao")}/>
      </Card>
    </Shell>);
}
export function EditProfileScreen() {
    const { user, act, run, tell } = useStore(), [name, setName] = useState(user?.name || ""), [bio, setBio] = useState(user?.bio || ""), [city, setCity] = useState(user?.city || ""), [phone, setPhone] = useState(user?.phone || ""), [avatar, setAvatar] = useState(user?.avatar), [busy, setBusy] = useState(false);
    async function pick() {
        try {
            setBusy(true);
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                tell("Permita o acesso à galeria para escolher uma foto.");
                return;
            }
            const r = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });
            if (!r.canceled) {
                const a = r.assets[0];
                if (a.base64 && a.base64.length < 1000000)
                    setAvatar(`data:${a.mimeType || "image/jpeg"};base64,${a.base64}`);
                else
                    tell("Escolha uma foto menor para a demonstração.");
            }
        }
        catch {
            tell("Não foi possível abrir a galeria.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<Shell title="Editar perfil">
      <View style={{ alignItems: "center", gap: 12 }}>
        <Avatar name={name || "Perfil"} uri={avatar} size={84}/>
        <Button title="Alterar foto" icon="camera-outline" secondary disabled={busy} onPress={pick}/>
      </View>
      <Field label="Nome" value={name} onChangeText={setName}/>
      <Field label="Biografia" value={bio} onChangeText={setBio} multiline maxLength={500}/>
      <Field label="Cidade" value={city} onChangeText={setCity}/>
      <Field label="Telefone com DDD" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
      <Txt muted>Email: {user?.email}</Txt>
      <Button title="Salvar perfil" icon="checkmark-outline" onPress={async () => {
            if (await run(async () => {
                if (name.trim().length < 3 ||
                    !city.trim() ||
                    !/^\d{10,11}$/.test(phone.replace(/\D/g, "")))
                    throw new Error("Confira nome, cidade e telefone com DDD.");
                await act({
                    type: "profile",
                    patch: {
                        name: name.trim(),
                        bio: bio.trim(),
                        city: city.trim(),
                        phone,
                        avatar,
                    },
                });
            }))
                router.replace("/perfil" as any);
        }}/>
    </Shell>);
}
export function SettingsScreen() {
    const { state, user, act, run } = useStore(), [confirm, setConfirm] = useState<"logout" | "delete" | null>(null);
    return (<Shell title="Configurações">
      <Card>
        <InfoRow icon="color-palette-outline">
          <Title>Aparência</Title>
        </InfoRow>
        <Txt>Escolha o tema do aplicativo.</Txt>
        <Row>
          <Button title="Escuro" icon="moon-outline" secondary={state.theme !== "dark"} onPress={async () => await act({ type: "theme", theme: "dark" })}/>
          <Button title="Claro" icon="sunny-outline" secondary={state.theme !== "light"} onPress={async () => await act({ type: "theme", theme: "light" })}/>
        </Row>
      </Card>
      <View style={{ gap: 8 }}>
        <MenuItem title="Alterar senha" icon="key-outline" onPress={() => go("alterar-senha")}/>
        <MenuItem title="Usuários bloqueados" icon="ban-outline" onPress={() => go("bloqueados")}/>
        <MenuItem title="Termos e privacidade" icon="shield-checkmark-outline" onPress={() => go("termos")}/>
        <MenuItem title="Sair da conta" icon="log-out-outline" onPress={() => setConfirm("logout")}/>
      </View>
      <Button title="Excluir minha conta" icon="trash-outline" danger onPress={() => setConfirm("delete")}/>
      <Confirm visible={!!confirm} title={confirm === "delete" ? "Excluir a conta?" : "Sair da conta?"} text={confirm === "delete"
            ? "A conta será desativada e o perfil público removido. Serviços ativos e saldo precisam ser resolvidos antes. O histórico de transações fica sem identificação pessoal."
            : "Seus dados continuarão no servidor. Os tokens desta sessão serão removidos."} onClose={() => setConfirm(null)} onConfirm={async () => {
            if (await run(async () => await act({ type: confirm === "delete" ? "deleteAccount" : "logout" })))
                router.replace("/login" as any);
        }}/>
    </Shell>);
}
export function ChangePasswordScreen() {
    const { user, changePassword, tell } = useStore(), [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState(""), [busy, setBusy] = useState(false);
    async function save() {
        setBusy(true);
        try {
            if (passwordError(next))
                throw new Error(passwordError(next));
            if (next !== confirm)
                throw new Error("As novas senhas precisam ser iguais.");
            await changePassword(current,next);
            tell("Senha alterada. Entre novamente.");
            router.replace("/login" as any);
        }
        catch (e) {
            tell(e instanceof Error ? e.message : "Não foi possível alterar.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<Shell title="Alterar senha">
      <Field label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry/>
      <Field label="Nova senha" value={next} onChangeText={setNext} secureTextEntry/>
      <Txt muted>
        Use ao menos 8 caracteres, maiúscula, minúscula, número e símbolo.
      </Txt>
      <Field label="Confirmar nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry/>
      <Button title="Salvar nova senha" icon="lock-closed-outline" disabled={busy} onPress={save}/>
    </Shell>);
}
export function BlockedScreen() {
    const { state, user } = useStore(), list = state.users.filter((u) => state.blocked[user?.id || ""]?.includes(u.id));
    return (<Shell title="Usuários bloqueados">
      {list.length ? (list.map((p) => (<Card key={p.id}>
            <Row>
              <Avatar name={p.name} uri={p.avatar}/>
              <Txt>{p.name}</Txt>
            </Row>
            <Button title="Gerenciar bloqueio" icon="ban-outline" secondary onPress={() => go("bloquear", p.id)}/>
          </Card>))) : (<Empty icon="shield-checkmark-outline" title="Nenhum usuário bloqueado" text="Os perfis bloqueados por você aparecerão aqui."/>)}
    </Shell>);
}
export function DemoScreen() {
 const {state,user,mode,connectionError,sync,run}=useStore();
 return <Shell title="Conexão com o servidor" publicPage>
  <Badge text={connectionError?'Servidor indisponível':'Dados sincronizados com o backend'}/>
  <Txt>API: {API_URL}</Txt><Txt>Pagamento: {mode==='mock'?'simulado no servidor':'Asaas'}</Txt>
  <Txt>Conta: {user?.name || 'Visitante'}. Anúncios carregados: {state.ads.length}.</Txt>
  <Button title="Atualizar dados" onPress={async()=>{await run(sync);}}/>
  <Txt muted>Para acompanhar os dois lados de um serviço, faça login como cliente em um celular e como profissional em outro. No mesmo celular, saia da conta antes de entrar com a outra.</Txt>
  <Button title="Ir ao login" secondary onPress={()=>go('login')}/>
 </Shell>;
}
export function TermsScreen() {
 return <Shell title="Termos e privacidade" publicPage>
  <Title>Tasker · protótipo acadêmico</Title>
  <Card><Txt>Cadastros, anúncios, mensagens, agendas, favoritos e protocolos são armazenados no servidor configurado e sincronizados entre dispositivos autenticados. Use dados de teste durante a apresentação.</Txt>
  <Txt>O modo de pagamento é definido no backend: mock simula os valores sem movimentar dinheiro; Asaas depende de configuração e homologação. Um pagamento recebido no sistema não representa um produto de custódia financeira.</Txt>
  <Txt>A autenticação usa senha validada no servidor e tokens JWT. No celular, os tokens ficam no armazenamento protegido do sistema. O tema fica no dispositivo.</Txt>
  <Txt>A exclusão desativa o acesso e remove o perfil público. O histórico de contratação e pagamentos é preservado para conciliação. A plataforma não fornece ligações de áudio.</Txt>
  <Txt>Os protocolos são recebidos pelo backend e podem ser consultados pela administração; não há equipe externa de atendimento configurada automaticamente.</Txt></Card>
 </Shell>;
}
