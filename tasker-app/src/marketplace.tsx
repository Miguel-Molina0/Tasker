import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { LogoMark } from "./brand";
import { available, categories, displayDate, money, parseDate, rating, uid, validDate, } from "./domain";
import { useStore } from "./store";
import { brand } from "./theme";
import { AdCard, Badge, Button, Card, CategoryPicker, categoryIcons, Chips, Confirm, Empty, Field, go, IconButton, InfoRow, QuickAction, Row, Section, Shell, ServiceImage, Title, Txt, useColors, VisualSteps, } from "./ui";
export function HomeScreen() {
    const { state, user } = useStore(), [cat, setCat] = useState("Todos"), c = useColors();
    const notices = state.notices.filter((n) => n.user === user?.id && !n.read).length;
    const ads = state.ads.filter((a) => a.published &&
        (cat === "Todos" || a.category === cat) &&
        !state.blocked[user?.id || ""]?.includes(a.provider));
    return (<Shell publicPage nav action={<IconButton name="notifications-outline" label={`Notificações, ${notices} não lidas`} onPress={() => go("notificacoes")}/>}>
      <Txt muted>
        {user ? `Olá, ${user.name.split(" ")[0]}!` : "Bem-vindo ao Tasker"}
      </Txt>
      <LinearGradient colors={brand.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
            borderRadius: 24,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: `${brand.lilac}26`,
        }}>
        <View style={{
            pointerEvents: "none",
            position: "absolute",
            right: -45,
            top: -80,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: brand.blue,
            opacity: 0.12,
        }}/>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{
            color: brand.pale,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 1.4,
        }}>
            TALENTOS PERTO DE VOCÊ
          </Text>
          <Text style={{
            color: brand.white,
            fontSize: 24,
            lineHeight: 30,
            fontWeight: "700",
        }}>
            Encontre quem faz acontecer.
          </Text>
        </View>
        <View style={{
            width: 104,
            height: 116,
            alignItems: "center",
            justifyContent: "center",
        }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{
            position: "absolute",
            width: 116,
            height: 116,
            borderRadius: 58,
            backgroundColor: `${brand.purple}18`,
            borderWidth: 1,
            borderColor: `${brand.lilac}12`,
            alignItems: "center",
            justifyContent: "center",
        }}>
            <View style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: `${brand.blue}14`,
        }}/>
          </View>
          <LogoMark size={96}/>
        </View>
        <LinearGradient colors={brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            pointerEvents: "none",
        }}/>
      </LinearGradient>
      <Pressable accessibilityRole="button" accessibilityLabel="Buscar serviços e profissionais" onPress={() => go("pesquisa")} style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 50,
            borderRadius: 16,
            paddingHorizontal: 15,
            backgroundColor: c.panel,
            borderWidth: 1,
            borderColor: c.line,
        }}>
        <Ionicons name="search-outline" size={22} color={c.accent} accessible={false}/>
        <View style={{ flex: 1 }}>
          <Txt muted>O que você precisa hoje?</Txt>
        </View>
        <Ionicons name="arrow-forward" size={19} color={c.blue} accessible={false}/>
      </Pressable>
      <CategoryPicker items={categories} value={cat} onChange={setCat}/>
      <Row>
        {[
            ["Agenda", "calendario", "calendar-outline"],
            ["Serviços", "meus-servicos", "briefcase-outline"],
            ["Favoritos", "favoritos", "heart-outline"],
        ].map(([label, path, icon]) => (<QuickAction key={path} label={label} icon={icon as React.ComponentProps<typeof Ionicons>["name"]} onPress={() => go(path)}/>))}
      </Row>
      {!user && (<Card>
          <InfoRow icon="person-circle-outline">
            <Txt>Entre para contratar e organizar sua agenda.</Txt>
          </InfoRow>
          <Button title="Entrar no Tasker" icon="log-in-outline" onPress={() => go("login")}/>
        </Card>)}
      {!!notices && (<Pressable accessibilityRole="button" accessibilityLabel={`Ver ${notices} atualizações`} onPress={() => go("notificacoes")}>
          <InfoRow icon="notifications-outline">
            <Txt style={{ color: c.accent }}>
              {notices} atualização(ões) para você
            </Txt>
          </InfoRow>
        </Pressable>)}
      <Section title={cat === "Todos"
            ? "Explore os serviços"
            : `Serviços de ${cat.toLowerCase()}`}/>
      {ads.length ? (ads.map((ad) => <AdCard key={ad.id} ad={ad} compact/>)) : (<Empty icon="search-outline" title="Nenhum anúncio nessa categoria" text="Explore outra especialidade ou pesquise por uma palavra-chave." action="Buscar serviços" onPress={() => go("pesquisa")}/>)}
    </Shell>);
}
export function SearchScreen() {
    const { state, user } = useStore(), params = useLocalSearchParams<{
        categoria?: string;
    }>(), c = useColors();
    const [query, setQuery] = useState(""), [cat, setCat] = useState(params.categoria || "Todos"), [city, setCity] = useState("Todas"), [stars, setStars] = useState("Qualquer nota"), [date, setDate] = useState(""), [filters, setFilters] = useState(false);
    const normalized = (s: string) => s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const dateISO = parseDate(date), invalid = !!date && !validDate(dateISO);
    const ads = state.ads.filter((a) => a.published &&
        !state.blocked[user?.id || ""]?.includes(a.provider) &&
        (cat === "Todos" || a.category === cat) &&
        (city === "Todas" || a.city === city) &&
        normalized(`${a.title} ${a.description} ${a.category} ${state.users.find((u) => u.id === a.provider)?.name}`).includes(normalized(query)) &&
        (stars === "Qualquer nota" ||
            Number(rating(state, a.provider)) >= Number(stars[0])) &&
        (!date || (!invalid && available(state, a, dateISO))));
    return (<Shell title="Buscar serviços" publicPage nav>
      <Field label="O que você precisa?" placeholder="Serviço, categoria ou profissional" value={query} onChangeText={setQuery}/>
      <CategoryPicker items={categories} value={cat} onChange={setCat}/>
      <Button title={filters ? "Fechar filtros" : "Filtrar por cidade, nota e data"} secondary icon="options-outline" onPress={() => setFilters(!filters)}/>
      {filters && (<Card>
          <Txt>Cidade de atendimento</Txt>
          <Chips items={["Todas", ...new Set(state.ads.map((a) => a.city))]} value={city} onChange={setCity}/>
          <Txt>Avaliação mínima</Txt>
          <Chips items={["Qualquer nota", "4 estrelas", "5 estrelas"]} icons={{
                "Qualquer nota": "star-outline",
                "4 estrelas": "star-half",
                "5 estrelas": "star",
            }} value={stars} onChange={setStars}/>
          <Field label="Disponibilidade (DD/MM/AAAA)" placeholder="Ex.: 25/09/2026" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"/>
          <Txt muted>
            A busca considera os dias de atendimento e horários livres. O
            horário exato é validado na contratação.
          </Txt>
          <Button title="Limpar filtros" secondary onPress={() => {
                setCat("Todos");
                setCity("Todas");
                setStars("Qualquer nota");
                setDate("");
                setQuery("");
            }}/>
        </Card>)}
      {invalid && (<Txt style={{ color: c.danger }}>Informe uma data válida.</Txt>)}
      <Txt muted>{ads.length} resultado(s)</Txt>
      {ads.length ? (ads.map((a) => <AdCard key={a.id} ad={a} compact/>)) : (<Empty title="Nenhum resultado" icon="search-outline" text="Tente outra palavra ou amplie os filtros."/>)}
    </Shell>);
}
export function FavoritesScreen() {
    const { state, user } = useStore();
    const ads = state.ads.filter((a) => a.published && state.favorites[user?.id || ""]?.includes(a.id));
    return (<Shell title="Favoritos" nav>
      <InfoRow icon="heart-outline">
        <Txt muted>Os serviços que você quer ter por perto.</Txt>
      </InfoRow>
      {ads.length ? (ads.map((a) => <AdCard key={a.id} ad={a}/>)) : (<Empty title="Seus favoritos ficam aqui" icon="heart-outline" text="Toque no coração de um anúncio para guardá-lo." action="Explorar serviços" onPress={() => go("pesquisa")}/>)}
    </Shell>);
}
export function AdScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { state, user } = useStore();
    const ad = state.ads.find((a) => a.id === id && (a.published || a.provider === user?.id));
    if (!ad)
        return (<Shell title="Anúncio" publicPage>
        <Empty title="Anúncio indisponível" text="Ele pode ter sido removido ou salvo como rascunho." action="Explorar serviços" onPress={() => go("pesquisa")}/>
      </Shell>);
    return (<Shell title="Detalhes do anúncio" publicPage>
      <AdCard ad={ad}/>
      <Section title="Como funciona">
        <VisualSteps steps={[
            {
                icon: "chatbubbles-outline",
                title: "Combine os detalhes",
                text: "Converse sobre o que precisa e o escopo do serviço.",
            },
            {
                icon: "calendar-outline",
                title: "Escolha a data",
                text: "A solicitação fica pendente nas duas agendas até o aceite.",
            },
            {
                icon: "lock-closed-outline",
                title: "Simule o pagamento",
                text: "O servidor acompanha o pagamento e a conclusão confirmada pelas duas partes.",
            },
        ]}/>
      </Section>
      <Card>
        <Txt style={{ fontWeight: "700" }}>Dias de atendimento</Txt>
        <InfoRow icon="calendar-outline">
          <Txt>
            {ad.days
            .map((d) => [
            "Domingo",
            "Segunda",
            "Terça",
            "Quarta",
            "Quinta",
            "Sexta",
            "Sábado",
        ][d])
            .join(" · ")}
          </Txt>
        </InfoRow>
        <InfoRow icon="pricetag-outline">
          <Txt>Valor do serviço: {money(ad.price)}</Txt>
        </InfoRow>
      </Card>
      {user?.id === ad.provider ? (<Button title="Editar anúncio" icon="create-outline" onPress={() => go("criar-anuncio", ad.id)}/>) : user?.role === "profissional" ? (<Txt muted>
          Esta conta é profissional. Use uma conta de cliente para solicitar
          serviços.
        </Txt>) : (<Button title="Solicitar contratação" icon="calendar-outline" onPress={() => go("solicitar-servico", ad.id)}/>)}
      <Button title="Conhecer profissional" secondary icon="person-outline" onPress={() => go("perfil-profissional", ad.provider)}/>
    </Shell>);
}
export { PublicProfileScreen as ProfessionalScreen } from "./profile-view";
export function MyAdsScreen() {
    const { state, user, act, run } = useStore(), [remove, setRemove] = useState<string | null>(null);
    const ads = state.ads.filter((a) => a.provider === user?.id);
    return (<Shell title="Meus anúncios" nav>
      {user?.role !== "profissional" ? (<Empty title="Área do profissional" text="Anúncios são publicados por contas profissionais."/>) : (<>
          <Button title="Criar anúncio" icon="add" onPress={() => go("criar-anuncio")}/>
          {ads.length ? (ads.map((a) => (<Card key={a.id}>
                <ServiceImage category={a.category} uri={a.images[0]} height={150}/>
                <Badge text={a.published ? "Publicado" : "Rascunho"}/>
                <Title>{a.title}</Title>
                <Txt muted>
                  {a.category} · {money(a.price)}
                </Txt>
                <Button title="Editar" icon="create-outline" onPress={() => go("criar-anuncio", a.id)}/>
                <Button title="Excluir anúncio" secondary icon="trash-outline" onPress={() => setRemove(a.id)}/>
              </Card>))) : (<Empty title="Mostre seu talento" text="Crie seu primeiro anúncio e apresente seu serviço."/>)}
        </>)}
      <Confirm visible={!!remove} title="Excluir anúncio?" text="Ele deixará de aparecer na busca. Contratações já feitas permanecem no histórico." onClose={() => setRemove(null)} onConfirm={async () => await run(async () => await act({ type: "deleteAd", id: remove! }))}/>
    </Shell>);
}
export function EditAdScreen() {
    const { id } = useLocalSearchParams<{
        id?: string;
    }>(), { state, user, act, run, tell } = useStore();
    const old = state.ads.find((a) => a.id === id && a.provider === user?.id);
    const [title, setTitle] = useState(old?.title || ""), [description, setDescription] = useState(old?.description || ""), [category, setCategory] = useState(old?.category || "Design"), [price, setPrice] = useState(old ? String(old.price) : ""), [city, setCity] = useState(old?.city || user?.city || ""), [days, setDays] = useState(old?.days || [1, 2, 3, 4, 5]), [images, setImages] = useState(old?.images || []), [busy, setBusy] = useState(false);
    async function pick() {
        try {
            setBusy(true);
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                tell("Permita o acesso à galeria para adicionar uma foto.");
                return;
            }
            const r = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.7,
                base64: true,
            });
            if (!r.canceled) {
                const a = r.assets[0];
                if (a.base64 && a.base64.length < 2000000)
                    setImages((v) => [
                        ...v,
                        `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`,
                    ].slice(0, 4));
                else
                    tell("Escolha uma imagem menor que 1,5 MB para o envio ao servidor.");
            }
        }
        catch {
            tell("Não foi possível abrir a galeria.");
        }
        finally {
            setBusy(false);
        }
    }
    const save = async (published: boolean) => {
        if (!user)
            return;
        if (await run(async () => await act({
            type: "ad",
            ad: {
                id: old?.id || uid(),
                provider: user.id,
                title: title.trim(),
                description: description.trim(),
                category,
                price: Number(price.replace(",", ".")),
                city: city.trim(),
                published,
                images,
                days,
            },
        })))
            router.replace("/meus-anuncios" as any);
    };
    return (<Shell title={old ? "Editar anúncio" : "Criar anúncio"}>
      {user?.role !== "profissional" ? (<Empty title="Área do profissional" text="Entre em uma conta profissional para divulgar seus serviços."/>) : id && !old ? (<Empty title="Anúncio não encontrado" text="Confira seus anúncios."/>) : (<>
          <Txt muted>
            Conte o que você faz e deixe claro o que está incluído.
          </Txt>
          <Field label="Título do serviço" value={title} onChangeText={setTitle} maxLength={90}/>
          <Field label="Descrição e escopo" value={description} onChangeText={setDescription} multiline maxLength={1500}/>
          <Txt>Categoria</Txt>
          <Chips items={categories.slice(1)} icons={categoryIcons} value={category} onChange={setCategory}/>
          <Field label="Preço do serviço (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad"/>
          <Field label="Cidade de atendimento" value={city} onChangeText={setCity}/>
          <Section title="Dias de atendimento">
            <Row>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (<Button key={d} title={d} secondary={!days.includes(i)} onPress={() => setDays((v) => v.includes(i)
                    ? v.filter((x) => x !== i)
                    : [...v, i].sort())}/>))}
            </Row>
          </Section>
          <Section title="Fotos do seu trabalho">
            {!images.length && <ServiceImage category={category} height={150}/>}
            <ScrollView horizontal contentContainerStyle={{ gap: 12 }}>
              {images.map((uri, i) => (<View key={i} style={{ gap: 6 }}>
                  <Image source={{ uri }} style={{ width: 130, height: 100, borderRadius: 12 }}/>
                  <Button title="Remover foto" secondary icon="trash-outline" onPress={() => setImages((v) => v.filter((_, j) => j !== i))}/>
                </View>))}
            </ScrollView>
            <Button title={busy ? "Abrindo galeria…" : "Adicionar foto"} secondary disabled={busy || images.length >= 4} icon="image-outline" onPress={pick}/>
          </Section>
          <Button title={old?.published ? "Salvar e publicar" : "Publicar anúncio"} icon="checkmark-circle-outline" onPress={() => save(true)}/>
          <Button title="Salvar como rascunho" secondary icon="document-outline" onPress={() => save(false)}/>
        </>)}
    </Shell>);
}
