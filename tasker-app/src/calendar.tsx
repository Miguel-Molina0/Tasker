import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { dayAfter, displayDate, isActive, localDate, parseDate, statusLabel, uid, validDate, } from "./domain";
import { useStore } from "./store";
import { Badge, Button, Card, Confirm, Empty, Field, go, IconButton, IconTile, InfoRow, MenuItem, Row, Shell, Title, Txt, useColors, } from "./ui";
export function CalendarScreen() {
    const { date } = useLocalSearchParams<{
        date?: string;
    }>(), { state, user } = useStore(), colors = useColors();
    const [selected, setSelected] = useState(date && validDate(date) ? date : localDate()), [month, setMonth] = useState(() => new Date((date && validDate(date) ? date : localDate()).slice(0, 7) +
        "-01T12:00:00"));
    const calendarIds=new Set((state.calendar||[]).filter(e=>["PENDENTE","CONFIRMADO"].includes(e.status)).map(e=>e.contract));
    const contracts = state.contracts.filter((c) => calendarIds.has(c.id)&& [c.client, c.provider].includes(user?.id || "") && isActive(c));
    const events = state.events.filter((e) => e.user === user?.id);
    const all = [
        ...contracts.map((c) => ({
            id: c.id,
            title: c.title,
            date: c.date,
            time: c.time,
            status: statusLabel[c.status],
            route: "detalhe-contratacao",
            pending: c.status === "pendente",
        })),
        ...events.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            time: e.time,
            status: "Compromisso pessoal",
            route: "detalhe-compromisso",
            pending: false,
        })),
    ].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const shown = all.filter((e) => e.date === selected), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), offset = month.getDay();
    function move(n: number) {
        setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1, 12));
    }
    return (<Shell title="Minha agenda" nav action={<IconButton name="add" label="Criar compromisso" onPress={() => go("criar-compromisso", undefined, { date: selected })}/>}>
      <Card>
        <Row>
          <IconTile icon="briefcase-outline" label="Serviços ativos" value={contracts.length}/>
          <IconTile icon="person-outline" label="Pessoais" value={events.length}/>
        </Row>
        <InfoRow icon="time-outline">
          <Txt muted>
            Solicitações pendentes reservam o horário nas duas agendas.
          </Txt>
        </InfoRow>
      </Card>
      <Card>
        <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        }}>
          <IconButton name="chevron-back" label="Mês anterior" onPress={() => move(-1)}/>
          <Txt style={{
            fontSize: 17,
            fontWeight: "700",
            textTransform: "capitalize",
        }}>
            {month.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        })}
          </Txt>
          <IconButton name="chevron-forward" label="Próximo mês" onPress={() => move(1)}/>
        </View>
        <View style={{ flexDirection: "row" }}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (<View key={i} style={{ width: "14.2857%", alignItems: "center" }}>
              <Txt muted>{d}</Txt>
            </View>))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {Array.from({ length: offset + days }, (_, i) => {
            const day = i - offset + 1;
            if (day < 1)
                return <View key={i} style={{ width: "14.2857%", height: 48 }}/>;
            const key = localDate(new Date(month.getFullYear(), month.getMonth(), day, 12)), has = all.some((e) => e.date === key);
            return (<Pressable key={i} accessibilityRole="button" accessibilityLabel={`${displayDate(key)}${has ? ", com compromissos" : ""}`} accessibilityState={{ selected: key === selected }} onPress={() => setSelected(key)} style={{ width: "14.2857%", minHeight: 48, padding: 2 }}>
                <View style={{
                    flex: 1,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: key === selected ? colors.primary : "transparent",
                    borderWidth: key === localDate() ? 1 : 0,
                    borderColor: colors.accent,
                }}>
                  <Txt style={{
                    color: key === selected ? "#fff" : colors.text,
                    fontWeight: "600",
                }}>
                    {day}
                  </Txt>
                  {has && (<View style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: key === selected ? "#fff" : colors.accent,
                    }}/>)}
                </View>
              </Pressable>);
        })}
        </View>
        <Button title="Ir para hoje" icon="today-outline" secondary onPress={() => {
            const d = new Date();
            setSelected(localDate());
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1, 12));
        }}/>
      </Card>
      <InfoRow icon="calendar-outline">
        <Title>{displayDate(selected)}</Title>
      </InfoRow>
      {shown.length ? (shown.map((e) => (<Card key={e.id}>
            <Row>
              <Badge text={e.time}/>
              <Badge text={e.status}/>
            </Row>
            <InfoRow icon={e.route === "detalhe-contratacao"
                ? "briefcase-outline"
                : "person-outline"}>
              <Txt style={{ fontWeight: "700", fontSize: 17 }}>{e.title}</Txt>
            </InfoRow>
            <Button title="Abrir compromisso" icon="arrow-forward-outline" secondary onPress={() => go(e.route, e.id)}/>
          </Card>))) : (<Empty icon="sunny-outline" title="Dia livre" text="Nenhum compromisso ativo nesta data." action="Adicionar compromisso pessoal" onPress={() => go("criar-compromisso", undefined, { date: selected })}/>)}
      <Title>Próximos compromissos</Title>
      {all
            .filter((e) => e.date >= localDate() && e.date !== selected)
            .slice(0, 4)
            .map((e) => (<Pressable key={e.id} onPress={() => {
                setSelected(e.date);
                setMonth(new Date(e.date.slice(0, 7) + "-01T12:00:00"));
            }}>
            <Card>
              <InfoRow icon="calendar-outline">
                <Txt>{displayDate(e.date)} · {e.time}</Txt>
              </InfoRow>
              <Txt style={{ fontWeight: "700" }}>{e.title}</Txt>
              <Badge text={e.status}/>
            </Card>
          </Pressable>))}
      <MenuItem title="Histórico de serviços" icon="time-outline" onPress={() => go("meus-servicos")}/>
    </Shell>);
}
export function EventEditorScreen() {
    const { id, date: initialDate } = useLocalSearchParams<{
        id?: string;
        date?: string;
    }>(), { state, user, act, run } = useStore(), old = state.events.find((e) => e.id === id && e.user === user?.id);
    const [title, setTitle] = useState(old?.title || ""), [date, setDate] = useState(displayDate(old?.date || initialDate || dayAfter(1))), [time, setTime] = useState(old?.time || "09:00"), [duration, setDuration] = useState(String(old?.duration || 60)), [note, setNote] = useState(old?.note || "");
    return (<Shell title={old ? "Editar compromisso" : "Criar compromisso"}>
      {id && !old ? (<Empty icon="calendar-outline" title="Compromisso indisponível" text="Ele não pertence à conta atual ou foi removido."/>) : (<>
          <InfoRow icon="person-outline">
            <Txt muted>
              Compromissos pessoais ficam apenas na sua agenda. Para agendar com
              um profissional, solicite a contratação pelo anúncio.
            </Txt>
          </InfoRow>
          <Field label="Título" value={title} onChangeText={setTitle}/>
          <Field label="Data (DD/MM/AAAA)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"/>
          <Field label="Horário (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation"/>
          <Field label="Duração (minutos)" value={duration} onChangeText={setDuration} keyboardType="number-pad"/>
          <Field label="Observações" value={note} onChangeText={setNote} multiline/>
          <Button title="Salvar compromisso" icon="checkmark-outline" onPress={async () => {
                if (user && await run(async () => await act({
                    type: "event",
                    event: {
                        id: old?.id || uid(),
                        user: user.id,
                        title,
                        date: parseDate(date),
                        time,
                        duration: Number(duration),
                        note,
                    },
                })))
                    router.replace({
                        pathname: "/calendario",
                        params: { date: parseDate(date) },
                    } as any);
            }}/>
        </>)}
    </Shell>);
}
export function EventScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user, act, run } = useStore(), [confirm, setConfirm] = useState(false), e = state.events.find((e) => e.id === id && e.user === user?.id);
    return (<Shell title="Compromisso pessoal">
      {e ? (<>
          <Card>
            <Title>{e.title}</Title>
            <Badge text="Somente na sua agenda"/>
            <InfoRow icon="calendar-outline">
              <Txt>{displayDate(e.date)}</Txt>
            </InfoRow>
            <InfoRow icon="time-outline">
              <Txt>{e.time} · {e.duration} minutos</Txt>
            </InfoRow>
            <InfoRow icon="document-text-outline">
              <Txt muted>{e.note || "Sem observações."}</Txt>
            </InfoRow>
          </Card>
          <Button title="Editar compromisso" icon="create-outline" onPress={() => go("criar-compromisso", e.id)}/>
          <Button title="Excluir compromisso" icon="trash-outline" secondary onPress={() => setConfirm(true)}/>
          <Confirm visible={confirm} title="Excluir compromisso?" text="O horário ficará livre na sua agenda." onClose={() => setConfirm(false)} onConfirm={async () => {
                if (await run(async () => await act({ type: "deleteEvent", id: e.id })))
                    router.replace("/calendario" as any);
            }}/>
        </>) : (<Empty icon="calendar-outline" title="Compromisso não encontrado" text="Abra sua agenda para selecionar outro compromisso." action="Minha agenda" onPress={() => go("calendario")}/>)}
    </Shell>);
}
export function RescheduleScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user, act, run } = useStore(), c = state.contracts.find((c) => c.id === id && [c.client, c.provider].includes(user?.id || "")), [date, setDate] = useState(displayDate(c?.date || dayAfter(1))), [time, setTime] = useState(c?.time || "10:00");
    return (<Shell title="Propor novo horário">
      {c ? (<>
          <Title>{c.title}</Title>
          <InfoRow icon="swap-horizontal-outline">
            <Txt muted>
              Atual: {displayDate(c.date)} às {c.time}. O novo horário só entra
              nas duas agendas quando a outra pessoa aceitar.
            </Txt>
          </InfoRow>
          <Field label="Nova data (DD/MM/AAAA)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"/>
          <Field label="Novo horário (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation"/>
          <Button title="Enviar proposta" icon="send-outline" onPress={async () => {
                if (await run(async () => await act({
                    type: "reschedule",
                    id: c.id,
                    date: parseDate(date),
                    time,
                })))
                    router.replace({
                        pathname: "/detalhe-contratacao",
                        params: { id: c.id },
                    } as any);
            }}/>
        </>) : (<Empty icon="calendar-outline" title="Serviço indisponível" text="Abra um serviço ativo para propor outro horário."/>)}
    </Shell>);
}
