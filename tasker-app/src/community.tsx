import {api} from './api';
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { uid } from "./domain";
import { useStore } from "./store";
import { brand } from "./theme";
import { Avatar, Badge, Button, Card, Chips, Confirm, Empty, Field, go, IconButton, InfoRow, MenuItem, Row, Shell, Title, Txt, useColors, } from "./ui";
export function ChatsScreen() {
    const { state, user } = useStore(), c = useColors(), [search, setSearch] = useState("");
    const peers = Array.from(new Set(state.messages
        .filter((m) => m.from === user?.id || m.to === user?.id)
        .map((m) => (m.from === user?.id ? m.to : m.from))))
        .map((id) => state.users.find((u) => u.id === id))
        .filter((u) => u && u.name.toLowerCase().includes(search.toLowerCase()));
    return (<Shell title="Conversas" nav>
      <Field label="Buscar conversa" value={search} onChangeText={setSearch}/>
      {peers.length ? (peers.map((p) => {
            if (!p)
                return null;
            const msgs = state.messages.filter((m) => (m.from === p.id && m.to === user?.id) ||
                (m.to === p.id && m.from === user?.id)), last = msgs[msgs.length - 1], unread = msgs.filter((m) => m.to === user?.id && !m.read).length;
            return (<Pressable key={p.id} onPress={() => go("chat", p.id)} accessibilityRole="button" accessibilityLabel={`Conversar com ${p.name}`}>
              <Card>
                <Row>
                  <Avatar name={p.name} uri={p.avatar}/>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: "700" }}>{p.name}</Txt>
                    <Txt muted>{last?.text.slice(0, 95)}</Txt>
                  </View>
                  {!!unread && <Badge text={String(unread)}/>}
                  <Ionicons name="chevron-forward" size={20} color={c.muted} accessible={false}/>
                </Row>
              </Card>
            </Pressable>);
        })) : (<Empty icon="chatbubbles-outline" title="Vamos começar uma conversa?" text="Abra um perfil ou anúncio e toque em Mensagem." action="Buscar profissionais" onPress={() => go("pesquisa")}/>)}
    </Shell>);
}
export function ChatScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user, act, run, sync } = useStore(), c = useColors(), [text, setText] = useState(""), [remove, setRemove] = useState<string | null>(null), scroll = useRef<ScrollView>(null), person = state.users.find((u) => u.id === id);
    const messages = state.messages.filter((m) => (m.from === user?.id && m.to === id) ||
        (m.from === id && m.to === user?.id)), unread = messages.filter((m) => m.to === user?.id && !m.read).length, blocked = !!(state.blocked[user?.id || ""]?.includes(id) ||
        state.blocked[id]?.includes(user?.id || ""));
    useEffect(() => {
        if (user && unread)
            void act({ type: "readMessages", from: id }).catch(()=>{});
    }, [id, user?.id, unread]);
    const [live,setLive]=useState(false);
    useEffect(()=>{
      if(!user||!person||person.id===user.id||blocked) return;
      let disposed=false;let socket:WebSocket|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
      async function connect() {
        try {
          const url=await api.socketUrl(id);if(disposed) return;
          socket=new WebSocket(url);
          socket.onopen=()=>{if(!disposed)setLive(true);};
          socket.onmessage=()=>{if(!disposed)void sync().catch(()=>{});};
          socket.onerror=()=>{if(!disposed)setLive(false);};
          socket.onclose=(event)=>{if(!disposed){setLive(false);if(event.code!==4403)timer=setTimeout(connect,5000);}};
        } catch {if(!disposed){setLive(false);timer=setTimeout(connect,5000);}}
      }
      void connect();
      return ()=>{disposed=true;setLive(false);if(timer)clearTimeout(timer);socket?.close();};
    },[id,user?.id,blocked,person?.id]);
    return (<Shell title={person?.name || "Conversa"} scroll={false} action={person && person.id !== user?.id ? (<IconButton name="ellipsis-horizontal" label="Opções da conversa" onPress={() => go("opcoes-conversa", id)}/>) : undefined}>
      {!person || person.id === user?.id ? (<Empty icon="chatbubble-ellipses-outline" title="Conversa indisponível" text="Selecione outra pessoa para conversar."/>) : (<>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${person.name}`} onPress={() => go("perfil-profissional", id)}>
            <Row>
              <Avatar name={person.name} uri={person.avatar} size={34}/>
              <View style={{ flex: 1 }}>
                <InfoRow icon="location-outline">
                  <Txt muted>{person.city}</Txt>
                </InfoRow>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.muted} accessible={false}/>
            </Row>
          </Pressable>
          <Txt muted>{live ? "Conectado em tempo real" : "Atualização periódica · aguardando conexão"}</Txt>
          <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingVertical: 16 }}>
            {messages.length ? (messages.map((m) => {
                const mine = m.from === user?.id, time = new Date(m.created).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                return (<Pressable key={m.id} onLongPress={() => mine && setRemove(m.id)} style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "86%",
                        padding: 13,
                        borderRadius: 17,
                        backgroundColor: mine ? c.primary : c.panel,
                        gap: 5,
                    }}>
                    <Txt style={{ color: mine ? c.onPrimary : c.text }}>
                      {m.text}
                    </Txt>
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "space-between",
                    }}>
                      <View accessible accessibilityLabel={`${time}${mine ? (m.read ? ", mensagem lida" : ", mensagem enviada") : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Txt style={{
                        fontSize: 11,
                        lineHeight: 16,
                        color: mine ? brand.pale : c.muted,
                    }}>
                          {time}
                        </Txt>
                        {mine && (<Ionicons name={m.read ? "checkmark-done" : "checkmark"} size={16} color={brand.pale} accessible={false}/>)}
                      </View>
                      {mine && (<IconButton name="trash-outline" label="Excluir mensagem" color={brand.pale} onPress={() => setRemove(m.id)}/>)}
                    </View>
                  </Pressable>);
            })) : (<Empty icon="chatbubble-ellipses-outline" title="Diga olá" text="Combine o escopo e tire suas dúvidas antes de contratar."/>)}
          </ScrollView>
          {blocked ? (<Card>
              <InfoRow icon="ban-outline">
                <Txt>
                  Mensagens indisponíveis: há um bloqueio entre estas contas.
                </Txt>
              </InfoRow>
              <Button title="Gerenciar bloqueio" icon="ban-outline" secondary onPress={() => go("bloquear", id)}/>
            </Card>) : (<View style={{ paddingBottom: 20, gap: 10 }}>
              <Field label="Mensagem" value={text} onChangeText={setText} multiline maxLength={2000} placeholder="Escreva aqui…" style={{ minHeight: 52, maxHeight: 110 }}/>
              <Button title="Enviar" icon="send-outline" disabled={!text.trim()} onPress={async () => {
                    if (await run(async () => await act({ type: "message", to: id, text })))
                        setText("");
                }}/>
            </View>)}
        </>)}
      <Confirm visible={!!remove} title="Excluir mensagem?" text="Esta mensagem será excluída do servidor pelo remetente." onClose={() => setRemove(null)} onConfirm={async () => await run(async () => await act({ type: "deleteMessage", id: remove! }))}/>
    </Shell>);
}
export function ChatOptionsScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    return (<Shell title="Opções da conversa">
      <MenuItem title="Ver perfil" icon="person-outline" onPress={() => go("perfil-profissional", id)}/>
      <MenuItem title="Ligação demonstrativa" icon="call-outline" subtitle="Simulação visual de chamada" onPress={() => go("ligacao", id)}/>
      <MenuItem title="Denunciar usuário" icon="flag-outline" onPress={() => go("denunciar", id)}/>
      <MenuItem title="Gerenciar bloqueio" icon="ban-outline" onPress={() => go("bloquear", id)}/>
    </Shell>);
}
export function CallScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user } = useStore(), c = useColors(), [status, setStatus] = useState("Pronta para simular"), person = state.users.find((u) => u.id === id), blocked = state.blocked[user?.id || ""]?.includes(id) ||
        state.blocked[id]?.includes(user?.id || "");
    return (<Shell title="Ligação demonstrativa">
      {!person || blocked ? (<Empty icon="call-outline" title="Ligação indisponível" text="Confira o perfil e os bloqueios da conversa."/>) : (<>
          <Badge text="Somente simulação visual"/>
          <View style={{ alignItems: "center", gap: 20, paddingVertical: 36 }}>
            <Avatar name={person.name} uri={person.avatar} size={90}/>
            <Title>{person.name}</Title>
            <Row>
              <Ionicons name="call-outline" size={18} color={c.accent} accessible={false}/>
              <Txt>{status}</Txt>
            </Row>
          </View>
          <Txt muted>
            Não há transmissão de áudio nem ligação telefônica nesta versão. A
            chamada real depende de integração futura.
          </Txt>
          {status === "Pronta para simular" ? (<Button title="Simular chamada" icon="call-outline" onPress={() => setStatus("Chamando…")}/>) : status === "Chamando…" ? (<>
              <Button title="Simular atendimento" icon="call-outline" onPress={() => setStatus("Chamada simulada em andamento")}/>
              <Button title="Simular chamada não atendida" icon="close-outline" secondary onPress={() => setStatus("Não atendida")}/>
            </>) : null}
          <Button title="Encerrar e voltar ao chat" icon="chatbubble-outline" secondary onPress={() => router.replace({ pathname: "/chat", params: { id } } as any)}/>
        </>)}
    </Shell>);
}
export function NotificationsScreen() {
    const { state, user, act, run } = useStore(), c = useColors(), list = state.notices.filter((n) => n.user === user?.id);
    return (<Shell title="Notificações" nav>
      {!!list.length && (<Button title="Marcar todas como lidas" icon="checkmark-done-outline" secondary onPress={async () => await run(()=>act({ type: "readNotice" }))}/>)}{" "}
      {list.length ? (list.map((n) => (<Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.read ? "" : "Nova notificação: "}${n.text}`} onPress={async () => {
                if(!await run(()=>act({ type: "readNotice", id: n.id })))return;
                go(n.route, n.target);
            }}>
            <Card>
              {!n.read && <Badge text="Nova"/>}
              <Row>
                <View style={{ flex: 1 }}>
                  <InfoRow icon={n.route === "chat"
                ? "chatbubble-outline"
                : n.route === "calendario"
                    ? "calendar-outline"
                    : "notifications-outline"}>
                    <Txt>{n.text}</Txt>
                  </InfoRow>
                </View>
                <Ionicons name="chevron-forward" size={20} color={c.muted} accessible={false}/>
              </Row>
            </Card>
          </Pressable>))) : (<Empty icon="notifications-outline" title="Tudo em dia" text="Mensagens, solicitações e atualizações dos seus serviços aparecerão aqui."/>)}
    </Shell>);
}
export function BlockScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user, act, run } = useStore(), [confirm, setConfirm] = useState(false), p = state.users.find((u) => u.id === id), blocked = state.blocked[user?.id || ""]?.includes(id);
    return (<Shell title="Bloqueio de usuário">
      {!p || id === user?.id ? (<Empty icon="person-outline" title="Perfil inválido" text="Abra o perfil de outra pessoa para gerenciar bloqueios."/>) : (<>
          <Row>
            <Avatar name={p.name} uri={p.avatar} size={56}/>
            <View style={{ flex: 1 }}><Title>{p.name}</Title></View>
          </Row>
          <InfoRow icon="shield-outline">
            <Txt>
              {blocked
                ? "Este usuário está bloqueado por você."
                : "Ao bloquear, novas mensagens e novas contratações entre vocês ficam indisponíveis."}
            </Txt>
          </InfoRow>
          <Txt muted>
            Serviços já contratados continuam acessíveis para conclusão,
            cancelamento ou suporte.
          </Txt>
          <Button title={blocked ? "Desbloquear usuário" : "Bloquear usuário"} icon={blocked ? "lock-open-outline" : "ban-outline"} danger={!blocked} onPress={() => setConfirm(true)}/>
          <Confirm visible={confirm} title={blocked ? "Desbloquear?" : "Bloquear?"} text={blocked
                ? "Vocês poderão voltar a conversar."
                : "As mensagens e novas solicitações serão bloqueadas."} onClose={() => setConfirm(false)} onConfirm={async () => await run(async () => await act({ type: "block", id }))}/>
        </>)}
    </Shell>);
}
export function ReportScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { user, act, run } = useStore(), [reason, setReason] = useState("Comportamento inadequado"), [text, setText] = useState(""), [protocol, setProtocol] = useState("");
    return (<Shell title="Denunciar usuário">
      {protocol ? (<Card>
          <InfoRow icon="checkmark-circle-outline">
            <Title>Relato registrado</Title>
          </InfoRow>
          <Txt>Protocolo: {protocol}</Txt>
          <Txt muted>
            Registro recebido pelo servidor e disponível para a administração.
          </Txt>
          <Button title="Ver meus protocolos" onPress={() => go("suporte")}/>
        </Card>) : (<>
          <Txt>Conte o que aconteceu. Você também pode bloquear o usuário.</Txt>
          <Chips icons={{
                "Comportamento inadequado": "chatbubble-outline",
                "Anúncio enganoso": "megaphone-outline",
                "Tentativa de golpe": "shield-outline",
                "Outro": "ellipsis-horizontal",
            }} items={[
                "Comportamento inadequado",
                "Anúncio enganoso",
                "Tentativa de golpe",
                "Outro",
            ]} value={reason} onChange={setReason}/>
          <Field label="Detalhes do relato" value={text} onChangeText={setText} multiline maxLength={2000}/>
          <Button title="Registrar denúncia" icon="flag-outline" onPress={async () => {
                let protocol='';
              if(user&&await run(async()=>{protocol=await act({type:'ticket',ticket:{id:uid(),user:user.id,subject:reason,text,target:id,created:new Date().toISOString()}}) as string;}))setProtocol(protocol);
        }}/>
          <Button title="Gerenciar bloqueio" icon="ban-outline" secondary onPress={() => go("bloquear", id)}/>
        </>)}
    </Shell>);
}
export function SupportScreen() {
    const { state, user, act, run } = useStore(), c = useColors(), [subject, setSubject] = useState("Dúvida sobre o aplicativo"), [text, setText] = useState(""), [faq, setFaq] = useState("");
    return (<Shell title="Ajuda e suporte">
      <InfoRow icon="help-buoy-outline">
        <Title>Como podemos ajudar?</Title>
      </InfoRow>
      {[
            [
                "Como funciona a agenda?",
                "Uma solicitação cria um compromisso pendente nas duas agendas. O aceite confirma o horário. O reagendamento precisa ser aceito pela outra pessoa.",
            ],
            [
                "Quando o valor é liberado?",
                "O recebimento é confirmado pelo servidor. As duas partes precisam confirmar a conclusão; em Asaas, o repasse é iniciado pela administração. Uma contestação bloqueia o pagamento.",
            ],
            [
                "Posso usar em dois celulares?",
                "Sim. Os celulares precisam acessar o mesmo backend. Os dados são atualizados periodicamente e as mensagens usam conexão em tempo real quando disponível.",
            ],
        ].map(([q, a]) => (<Pressable key={q} accessibilityRole="button" accessibilityLabel={q} accessibilityState={{ expanded: faq === q }} onPress={() => setFaq(faq === q ? "" : q)}>
          <Card>
            <Row>
              <View style={{ flex: 1 }}>
                <InfoRow icon={q.includes("agenda")
                ? "calendar-outline"
                : q.includes("valor")
                    ? "wallet-outline"
                    : "phone-portrait-outline"}>
                  <Txt style={{ fontWeight: "700" }}>{q}</Txt>
                </InfoRow>
              </View>
              <Ionicons name={faq === q ? "chevron-up" : "chevron-down"} size={20} color={c.muted} accessible={false}/>
            </Row>
            {faq === q && <Txt muted>{a}</Txt>}
          </Card>
        </Pressable>))}
      <Field label="Assunto" value={subject} onChangeText={setSubject}/>
      <Field label="Sua mensagem" value={text} onChangeText={setText} multiline/>
      <Button title="Abrir protocolo" icon="document-text-outline" onPress={async () => {
            if (user && await run(async () => await act({
                type: "ticket",
                ticket: {
                    id: uid(),
                    user: user.id,
                    subject: subject.trim() || "Suporte",
                    text,
                    created: new Date().toISOString(),
                },
            }), "Protocolo recebido pelo servidor. Você pode acompanhar abaixo."))
                setText("");
        }}/>
      <Title>Meus protocolos</Title>
      {state.tickets
            .filter((t) => t.user === user?.id)
            .map((t) => (<Card key={t.id}>
            <Badge text="Recebido pelo servidor"/>
            <Txt style={{ fontWeight: "700" }}>{t.subject}</Txt>
            <Txt>{t.text}</Txt>{t.status&&<Badge text={t.status}/>} {t.response&&<Txt>Resposta: {t.response}</Txt>}
            <Txt muted>#{t.id}</Txt>
          </Card>))}
    </Shell>);
}
