import * as Clipboard from 'expo-clipboard';
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useRef } from "react";
import { Image, Pressable, View } from "react-native";
import { Contract, dayAfter, displayDate, isActive, money, parseDate, paymentLabel, statusLabel, uid, wallet, } from "./domain";
import { useStore } from "./store";
import { Badge, Button, Card, Chips, Confirm, Empty, Field, go, IconTile, InfoRow, Row, Section, ServiceImage, Shell, Title, Txt, useColors, VisualSteps, } from "./ui";
function ContractCard({ contract: c }: {
    contract: Contract;
}) {
    const { state, user } = useStore();
    const other = state.users.find((u) => u.id === (c.client === user?.id ? c.provider : c.client));
    return (<Card>
      <Badge text={statusLabel[c.status]}/>
      <Title>{c.title}</Title>
      <InfoRow icon="person-outline">
        <Txt muted>{other?.name || "Usuário removido"}</Txt>
      </InfoRow>
      <InfoRow icon="calendar-outline">
        <Txt>{displayDate(c.date)} às {c.time}</Txt>
      </InfoRow>
      <InfoRow icon="wallet-outline">
        <Txt>{money(c.price)} · {paymentLabel[c.payment]}</Txt>
      </InfoRow>
      <Button title="Ver detalhes do serviço" icon="arrow-forward-outline" secondary onPress={() => go("detalhe-contratacao", c.id)}/>
    </Card>);
}
export function ServicesScreen() {
    const { state, user } = useStore(), [filter, setFilter] = useState("Ativos");
    const list = state.contracts.filter((c) => [c.client, c.provider].includes(user?.id || "") &&
        (filter === "Todos" ||
            (filter === "Ativos" ? isActive(c) : !isActive(c))));
    return (<Shell title="Meus serviços" nav>
      <Txt muted>
        {user?.role === "profissional"
            ? "Receba solicitações e acompanhe suas entregas."
            : "Acompanhe do primeiro contato à entrega."}
      </Txt>
      <Chips items={["Ativos", "Histórico", "Todos"]} icons={{
            Ativos: "time-outline",
            Histórico: "archive-outline",
            Todos: "grid-outline",
        }} value={filter} onChange={setFilter}/>
      {list.length ? (list.map((c) => <ContractCard key={c.id} contract={c}/>)) : (<Empty icon="briefcase-outline" title="Nenhum serviço por aqui" text={user?.role === "profissional"
                ? "Suas solicitações recebidas aparecerão aqui."
                : "Encontre um profissional e envie sua primeira solicitação."} action={user?.role === "cliente"
                ? "Encontrar profissional"
                : "Meus anúncios"} onPress={() => go(user?.role === "cliente" ? "pesquisa" : "meus-anuncios")}/>)}
    </Shell>);
}
export function RequestScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user, act, run } = useStore(), ad = state.ads.find((a) => a.id === id && a.published);
    const [description, setDescription] = useState(""), [address, setAddress] = useState(""), [date, setDate] = useState(displayDate(dayAfter(1))), [time, setTime] = useState("09:00"), [duration, setDuration] = useState("60");
    const requestKey=useRef(uid());
    async function submit() {
      if(!ad||!user) return;
      let serverId='';
      if(await run(async()=>{serverId=await act({type:'request',contract:{id:requestKey.current,client:user.id,provider:ad.provider,ad:ad.id,
        title:ad.title,description,address,date:parseDate(date),time,duration:Number(duration),price:ad.price,status:'pendente',payment:'nao_pago'}}) as string;})) {
        router.replace({pathname:'/detalhe-contratacao',params:{id:serverId}} as any);
      }
    }
    return (<Shell title="Solicitar serviço">
      {!ad ? (<Empty icon="search-outline" title="Escolha um serviço primeiro" text="Abra um anúncio para solicitar a contratação." action="Buscar serviços" onPress={() => go("pesquisa")}/>) : user?.role !== "cliente" ? (<Empty icon="person-outline" title="Use uma conta de cliente" text="Faça login com uma conta de cliente para solicitar serviços."/>) : (<>
          <Card>
            <ServiceImage category={ad.category} uri={ad.images[0]} height={160}/>
            <Badge text="Nova solicitação"/>
            <Title>{ad.title}</Title>
            <InfoRow icon="person-outline">
              <Txt>{state.users.find((u) => u.id === ad.provider)?.name}</Txt>
            </InfoRow>
            <InfoRow icon="pricetag-outline">
              <Txt>{money(ad.price)}</Txt>
            </InfoRow>
            <Txt muted>{ad.description}</Txt>
          </Card>
          <Field label="Descreva o que precisa" value={description} onChangeText={setDescription} multiline placeholder="Escopo, necessidades e detalhes combinados"/>
          <Field label="Endereço ou atendimento remoto" value={address} onChangeText={setAddress} placeholder="Local do serviço ou link da reunião"/>
          <Field label="Data (DD/MM/AAAA)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"/>
          <Field label="Horário (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation"/>
          <Field label="Duração combinada (minutos)" value={duration} onChangeText={setDuration} keyboardType="number-pad"/>
          <Txt muted>
            O valor é o anunciado, não uma tarifa por hora. Combine alterações
            de escopo com o profissional antes de solicitar.
          </Txt>
          <Card>
            <VisualSteps steps={[
                {
                    icon: "calendar-outline",
                    title: "Solicite",
                    text: "O compromisso aparece como pendente nas duas agendas.",
                },
                {
                    icon: "checkmark-circle-outline",
                    title: "Aguarde o aceite",
                    text: "O profissional confirma a solicitação.",
                },
                {
                    icon: "wallet-outline",
                    title: "Acompanhe o pagamento",
                    text: "O recebimento é confirmado pelo servidor.",
                },
            ]}/>
          </Card>
          <Button title="Enviar solicitação" icon="send-outline" onPress={submit}/>
          <Button title="Conversar antes de solicitar" icon="chatbubble-ellipses-outline" secondary onPress={() => go("chat", ad.provider)}/>
        </>)}
    </Shell>);
}
export function ContractScreen() {
 const {id}=useLocalSearchParams<{id:string}>();
 const {state,user,act,run,mode:paymentMode}=useStore();
 const [reason,setReason]=useState(''),[mode,setMode]=useState<'cancel'|'dispute'|null>(null);
 const c=state.contracts.find(c=>c.id===id&&[c.client,c.provider].includes(user?.id || ''));
 if(!c) return <Shell title="Detalhes do serviço"><Empty icon="briefcase-outline" title="Serviço não encontrado" text="Confira os serviços vinculados à sua conta." action="Meus serviços" onPress={()=>go('meus-servicos')}/></Shell>;
 const provider=c.provider===user?.id,other=state.users.find(u=>u.id===(provider?c.client:c.provider));
 const confirmed=provider?c.confirmedProvider:c.confirmedClient;
 const ad=state.ads.find(a=>a.id===c.ad);
 async function transition(event:'accept'|'decline'|'finish'|'confirm'|'cancel'|'dispute') {return run(()=>act({type:'transition',id:c!.id,event,reason}));}
 return <Shell title="Detalhes do serviço">
  <Card>{ad&&<ServiceImage category={ad.category} uri={ad.images[0]} height={150}/>}
   <Badge text={statusLabel[c.status]}/><Title>{c.title}</Title><Txt>{other?.name || 'Perfil indisponível'} · {provider?'Cliente':'Profissional'}</Txt>
   <Txt muted>{c.description}</Txt><InfoRow icon="calendar-outline"><Txt>{displayDate(c.date)} às {c.time} · {c.duration} minutos</Txt></InfoRow>
   <InfoRow icon="location-outline"><Txt>{c.address}</Txt></InfoRow><Txt>{money(c.price)} · {paymentLabel[c.payment]}</Txt>
  </Card>
  {c.status==='pendente'&&(provider?<><Button title="Aceitar solicitação" icon="checkmark-outline" onPress={()=>transition('accept')}/><Button title="Recusar solicitação" secondary onPress={()=>transition('decline')}/></>:<Txt muted>Aguardando o prestador aceitar. Compromisso pendente nas duas agendas.</Txt>)}
  {['em_andamento','aguardando_confirmacao'].includes(c.status)&&<Card>
   <Title>Confirmação do serviço</Title><Txt>Cliente: {c.confirmedClient?'confirmou':'aguardando'} · Profissional: {c.confirmedProvider?'confirmou':'aguardando'}</Txt>
   <Txt muted>As duas partes precisam confirmar a conclusão. O pagamento só pode ser repassado após o recebimento.</Txt>
   <Button title={confirmed?'Sua confirmação já foi registrada':'Confirmar conclusão do serviço'} icon="checkmark-done-outline" disabled={confirmed} onPress={()=>transition(provider?'finish':'confirm')}/>
   <Button title="Contestar serviço" secondary onPress={()=>setMode('dispute')}/>
  </Card>}
  {c.status==='concluida'&&!state.reviews.some(r=>r.contract===c.id&&r.from===user?.id)&&<Button title="Avaliar experiência" icon="star-outline" onPress={()=>go('avaliar-servico',c.id)}/>}
  {!provider&&<Button title="Ver pagamento" icon="wallet-outline" secondary onPress={()=>go('pagamento',c.id)}/>}
  {paymentMode==='asaas'&&c.status==='concluida'&&c.payment==='retido'&&<Txt muted>Conclusão registrada. O repasse aguarda a administração do servidor.</Txt>}
  {c.change&&<Card><Title>Alteração de horário</Title><Txt>{displayDate(c.change.date)} às {c.change.time}</Txt>
   {c.change.by===user?.id?<Txt muted>Aguardando a outra parte responder.</Txt>:<>
    <Button title="Aceitar novo horário" onPress={()=>run(()=>act({type:'answerChange',id:c.id,accept:true}))}/>
    <Button title="Manter horário anterior" secondary onPress={()=>run(()=>act({type:'answerChange',id:c.id,accept:false}))}/></>}
  </Card>}
  {['pendente','em_andamento','aguardando_confirmacao'].includes(c.status)&&<>
   <Button title="Propor outro horário" secondary disabled={!!c.change} onPress={()=>go('reagendar',c.id)}/>
   <Button title="Cancelar contratação" secondary onPress={()=>setMode('cancel')}/>
  </>}
  {mode&&<Card><Title>{mode==='cancel'?'Cancelar contratação':'Contestar serviço'}</Title>
   <Field label="Motivo" value={reason} onChangeText={setReason} multiline/>
   <Txt muted>{mode==='cancel'?'O horário será liberado. Eventual estorno será acompanhado pelo servidor.':'O pagamento será bloqueado e um protocolo será registrado para análise.'}</Txt>
   <Button title="Confirmar" danger onPress={async()=>{if(await transition(mode!))setMode(null);}}/>
   <Button title="Voltar sem alterar" secondary onPress={()=>setMode(null)}/>
  </Card>}
  {c.reason&&<Txt muted>{c.reason}</Txt>}
  <Button title="Abrir conversa" icon="chatbubble-ellipses-outline" secondary onPress={()=>go('chat',provider?c.client:c.provider)}/>
  <Button title="Ver na agenda" secondary onPress={()=>go('calendario',undefined,{date:c.date})}/>
 </Shell>;
}
export function PaymentScreen() {
 const {id}=useLocalSearchParams<{id:string}>();
 const {state,user,mode,sync,run,tell}=useStore();
 const c=state.contracts.find(c=>c.id===id&&c.client===user?.id);
 return <Shell title="Pagamento">
  {!c?<Empty icon="wallet-outline" title="Selecione uma contratação" text="Abra um serviço para consultar o pagamento."/>:<>
   <Badge text={mode==='mock'?'Simulação no servidor · sem cobrança real':'Pagamento Pix · Asaas'}/>
   <Card><Title>{c.title}</Title><Txt>{money(c.price)}</Txt><Txt>{paymentLabel[c.payment]}</Txt>
    <Txt muted>A confirmação do recebimento vem do servidor. Atualize para acompanhar.</Txt></Card>
   {mode==='asaas'&&c.payment==='nao_pago'&&c.pixImage&&<Image source={{uri:'data:image/png;base64,'+c.pixImage}} style={{width:230,height:230,alignSelf:'center'}} resizeMode="contain"/>}
   {mode==='asaas'&&c.payment==='nao_pago'&&c.pixCode&&<Card><Txt>{c.pixCode}</Txt><Button title="Copiar código Pix" onPress={async()=>{await Clipboard.setStringAsync(c.pixCode!);tell('Código Pix copiado.');}}/></Card>}
   {mode==='asaas'&&c.payment==='nao_pago'&&!c.pixCode&&<Txt muted>Cobrança ou QR Code ainda indisponível. Confira com o suporte antes de repetir a solicitação.</Txt>}
   {mode==='mock'&&<Txt muted>O backend simula o recebimento na solicitação. O repasse simulado acontece após a conclusão pelas duas partes.</Txt>}
   <Button title="Atualizar pagamento" icon="refresh-outline" onPress={()=>run(sync)}/>
   <Button title="Voltar ao serviço" secondary onPress={()=>router.replace({pathname:'/detalhe-contratacao',params:{id:c.id}} as any)}/>
  </>}
 </Shell>;
}
export function ReviewScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user, act, run } = useStore(), colors = useColors(), [stars, setStars] = useState(0), [text, setText] = useState("");
    const c = state.contracts.find((c) => c.id === id && [c.client, c.provider].includes(user?.id || "")), existing = state.reviews.find((r) => r.contract === id && r.from === user?.id);
    return (<Shell title="Avaliar experiência">
      {!c || c.status !== "concluida" ? (<Empty icon="star-outline" title="Avalie após a conclusão" text="Abra um serviço concluído no seu histórico." action="Meus serviços" onPress={() => go("meus-servicos")}/>) : existing ? (<Card>
          <Title>Avaliação enviada</Title>
          <View accessibilityLabel={`${existing.stars} de 5 estrelas`} accessible>
            <Row>
              {[1, 2, 3, 4, 5].map((n) => (<Ionicons key={n} name={n <= existing.stars ? "star" : "star-outline"} size={27} color={n <= existing.stars ? colors.accent : colors.muted} accessible={false}/>))}
            </Row>
          </View>
          <Txt>{existing.text}</Txt>
        </Card>) : (<>
          <Title>Como foi sua experiência?</Title>
          <Txt muted>{c.title}</Txt>
          <Row>
            {[1, 2, 3, 4, 5].map((n) => (<Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} estrela${n > 1 ? "s" : ""}`} accessibilityState={{ selected: n === stars }} onPress={() => setStars(n)} style={({ pressed }) => ({
                    minWidth: 44,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    backgroundColor: n <= stars ? colors.panel : "transparent",
                    opacity: pressed ? 0.7 : 1,
                })}>
                <Ionicons name={n <= stars ? "star" : "star-outline"} size={32} color={n <= stars ? colors.accent : colors.muted} accessible={false}/>
              </Pressable>))}
          </Row>
          <Txt muted>
            {stars
                ? `${stars} de 5 · ${["Ruim", "Regular", "Bom", "Muito bom", "Excelente"][stars - 1]}`
                : "Toque em uma estrela para avaliar."}
          </Txt>
          <Field label="Conte como foi o serviço" value={text} onChangeText={setText} multiline maxLength={1000}/>
          <Button title="Enviar avaliação" icon="star-outline" onPress={async () => {
                if (await run(async () => await act({
                    type: "review",
                    review: {
                        id: uid(),
                        contract: c.id,
                        from: user!.id,
                        to: c.client === user?.id ? c.provider : c.client,
                        stars,
                        text,
                    },
                })))
                    router.replace({
                        pathname: "/detalhe-contratacao",
                        params: { id: c.id },
                    } as any);
            }}/>
        </>)}
    </Shell>);
}
export function WalletScreen() {
    const { state, user } = useStore(), [filter, setFilter] = useState("Todos"), totals = wallet(state, user?.id || "");
    const list = state.contracts.filter((c) => (user?.role === "profissional"
        ? c.provider === user.id
        : c.client === user?.id) &&
        c.payment !== "nao_pago" &&
        (filter === "Todos" ||
            (filter === "Aguardando repasse"
                ? ["retido", "bloqueado"].includes(c.payment)
                : c.payment === "liberado")));
    return (<Shell title="Carteira" nav>
      <Badge text="Pagamentos registrados no servidor"/>
      {user?.role === "profissional" ? (<Card>
          <IconTile icon="wallet-outline" label="Total repassado" value={money(totals.released)}/>
          <InfoRow icon="lock-closed-outline">
            <Txt>Aguardando repasse: {money(totals.held)}</Txt>
          </InfoRow>
          <Button title="Repasse gerenciado no servidor" icon="arrow-up-outline" disabled={true} onPress={() => go("saque")}/>
          <Button title="Ver desempenho" icon="stats-chart-outline" secondary onPress={() => go("desempenho")}/>
        </Card>) : (<Card>
          <Title>Seus pagamentos</Title>
          <InfoRow icon="wallet-outline">
            <Txt muted>
              Acompanhe pagamentos, valores em custódia e reembolsos dos
              serviços contratados.
            </Txt>
          </InfoRow>
        </Card>)}
      <Chips items={["Todos", "Aguardando repasse", "Liberados"]} icons={{
            Todos: "list-outline",
            "Aguardando repasse": "lock-closed-outline",
            Liberados: "checkmark-circle-outline",
        }} value={filter} onChange={setFilter}/>
      {list.length ? (list.map((c) => <ContractCard key={c.id} contract={c}/>)) : (<Empty icon="wallet-outline" title="Nenhuma movimentação" text="Os pagamentos do servidor aparecerão aqui."/>)}
      {user?.role === "profissional" && (<Section title="Saques simulados">
          {state.withdrawals
                .filter((w) => w.user === user.id)
                .map((w) => (<Card key={w.id}>
                <InfoRow icon="arrow-up-circle-outline">
                  <Txt>
                    {money(w.value)} ·{" "}
                    {new Date(w.created).toLocaleDateString("pt-BR")}
                  </Txt>
                </InfoRow>
                <Badge text="Simulação concluída"/>
              </Card>))}
        </Section>)}
    </Shell>);
}
export function WithdrawScreen() {
 return <Shell title="Repasses"><Card><Title>Transferência pelo servidor</Title><Txt>Um repasse liberado já foi enviado para o destino configurado. Não existe segundo saque do mesmo pagamento. Em modo Asaas, a administração libera o repasse após a conclusão pelas duas partes e a confirmação do recebimento.</Txt></Card><Button title="Ver carteira" secondary onPress={()=>go('carteira')}/></Shell>;
}
export function PerformanceScreen() {
    const { state, user } = useStore(), own = state.contracts.filter((c) => c.provider === user?.id), totals = wallet(state, user?.id || "");
    return (<Shell title="Meu desempenho">
      {user?.role !== "profissional" ? (<Empty icon="stats-chart-outline" title="Área do profissional" text="O painel resume os serviços prestados."/>) : (<>
          <Card>
            <Row>
              <IconTile icon="checkmark-done-outline" label="Serviços concluídos" value={String(own.filter((c) => c.status === "concluida").length)}/>
              <IconTile icon="time-outline" label="Serviços ativos" value={String(own.filter((c) => isActive(c)).length)}/>
            </Row>
            <InfoRow icon="wallet-outline">
              <Txt>Receita liberada: {money(totals.released)}</Txt>
            </InfoRow>
            <InfoRow icon="lock-closed-outline">
              <Txt>Aguardando repasse: {money(totals.held)}</Txt>
            </InfoRow>
          </Card>
          <Section title="Por etapa">
            {Object.entries(statusLabel).map(([key, label]) => (<Row key={key}>
                <Txt>{label}</Txt>
                <Badge text={String(own.filter((c) => c.status === key).length)}/>
              </Row>))}
          </Section>
          <Button title="Ver carteira" icon="wallet-outline" onPress={() => go("carteira")}/>
        </>)}
    </Shell>);
}
