import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, } from "react-native";
import { Ad, money, rating, Review, User } from "./domain";
import { useStore } from "./store";
import { brand } from "./theme";
import { Avatar, back, Button, categoryIcons, Empty, go, IconButton, MenuItem, Shell, Title, Txt, useColors, } from "./ui";
// Portraits only illustrate the existing fictional demonstration accounts.
const demoPortraits: Record<string, number> = {
    cliente: require("../assets/images/profiles/cliente.jpg"),
    pedro: require("../assets/images/profiles/pedro.jpg"),
    joao: require("../assets/images/profiles/joao.jpg"),
    marina: require("../assets/images/profiles/marina.jpg"),
    bia: require("../assets/images/profiles/bia.jpg"),
};
const demoServices: Record<string, number> = {
    Design: require("../assets/images/services/design.jpg"),
    Elétrica: require("../assets/images/services/eletrica.jpg"),
    Limpeza: require("../assets/images/services/limpeza.jpg"),
    Beleza: require("../assets/images/services/beleza.jpg"),
};
function ProfilePhoto({ person, cover = false, }: {
    person?: User;
    cover?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [person?.id, person?.avatar]);
    const ownPhoto = !!person?.avatar && !failed;
    const source = ownPhoto
        ? { uri: person!.avatar! }
        : demoPortraits[person?.id || ""];
    return (<View style={cover ? StyleSheet.absoluteFill : styles.thumbnail}>
      {source ? (<Image source={source} resizeMode="cover" accessible accessibilityRole="image" accessibilityLabel={ownPhoto
                ? `Foto de ${person?.name}`
                : `Foto ilustrativa de ${person?.name}`} onError={() => {
                if (ownPhoto)
                    setFailed(true);
            }} style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}/>) : (<LinearGradient colors={brand.heroGradient} style={[styles.photoFallback, cover && { paddingBottom: 70 }]}>
          <Avatar name={person?.name || "Perfil removido"} size={cover ? 108 : 58}/>
        </LinearGradient>)}
      {cover && source && !ownPhoto && (<View style={styles.examplePhoto}>
          <Ionicons name="image-outline" size={11} color={brand.white} accessible={false}/>
          <Text style={styles.exampleText}>Foto ilustrativa</Text>
        </View>)}
    </View>);
}
function ServiceThumbnail({ ad }: {
    ad: Ad;
}) {
    const c = useColors();
    const [failed, setFailed] = useState(false);
    const uri = ad.images[0];
    useEffect(() => setFailed(false), [uri]);
    const uploaded = !!uri && !failed;
    const source = uploaded ? { uri } : demoServices[ad.category];
    return (<View style={[styles.thumbnail, { backgroundColor: c.panel }]}>
      {source ? (<Image source={source} resizeMode="cover" accessible accessibilityRole="image" accessibilityLabel={uploaded
                ? `Foto de ${ad.title}`
                : `Imagem ilustrativa de ${ad.category}`} onError={() => {
                if (uploaded)
                    setFailed(true);
            }} style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}/>) : (<Ionicons name={categoryIcons[ad.category] || "briefcase-outline"} size={30} color={c.accent} accessible={false}/>)}
      {!uploaded && source && (<View style={styles.exampleThumbnail}>
          <Ionicons name="image-outline" size={10} color={brand.white} accessible={false}/>
        </View>)}
    </View>);
}
function ReviewRow({ review }: {
    review: Review;
}) {
    const { state } = useStore();
    const c = useColors();
    const author = state.users.find((p) => p.id === review.from);
    return (<View style={[styles.listRow, { borderBottomColor: c.line }]}>
      <ProfilePhoto person={author}/>
      <View style={styles.rowContent}>
        <Txt style={{ fontSize: 16, fontWeight: "600" }}>
          {author?.name || "Usuário removido"}
        </Txt>
        <View accessible accessibilityLabel={`${review.stars} de 5 estrelas`} style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (<Ionicons key={star} name={star <= review.stars ? "star" : "star-outline"} size={15} color={c.accent} accessible={false}/>))}
        </View>
        <Txt muted style={{ fontSize: 13, lineHeight: 19 }}>
          {review.text}
        </Txt>
      </View>
    </View>);
}
function ProfileAdRow({ ad, own }: {
    ad: Ad;
    own: boolean;
}) {
    const { state, user, act, run } = useStore();
    const c = useColors();
    const saved = !!user && !!state.favorites[user.id]?.includes(ad.id);
    return (<View style={[styles.listRow, { borderBottomColor: c.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver serviço: ${ad.title}`} onPress={() => go("anuncio", ad.id)} style={styles.adLink}>
        <ServiceThumbnail ad={ad}/>
        <View style={styles.rowContent}>
          <Txt numberOfLines={1} style={{ fontSize: 17, fontWeight: "600" }}>
            {ad.title}
          </Txt>
          <Txt muted numberOfLines={2} style={{ fontSize: 13, lineHeight: 19 }}>
            {ad.description}
          </Txt>
          <Txt style={{ color: c.accent, fontSize: 13, fontWeight: "700" }}>
            {money(ad.price)}
          </Txt>
        </View>
      </Pressable>
      <IconButton name={own ? "create-outline" : saved ? "heart" : "heart-outline"} color={saved && !own ? c.danger : c.accent} label={own
            ? `Editar ${ad.title}`
            : saved
                ? `Remover ${ad.title} dos favoritos`
                : `Favoritar ${ad.title}`} onPress={async () => {
            if (own)
                go("criar-anuncio", ad.id);
            else if (user)
                await run(async () => await act({ type: "favorite", id: ad.id }));
            else
                go("login", undefined, { next: "/perfil-profissional", id: ad.provider });
        }}/>
    </View>);
}
function ProfileView({ own = false, personId, }: {
    own?: boolean;
    personId?: string;
}) {
    const { state, user } = useStore();
    const c = useColors();
    const { width } = useWindowDimensions();
    const person = own ? user : state.users.find((p) => p.id === personId);
    const [tab, setTab] = useState<"Avaliações" | "Anúncios" | null>(null);
    const [menu, setMenu] = useState<"profile" | "services" | null>(null);
    useEffect(() => {
        setTab(null);
        setMenu(null);
    }, [person?.id]);
    const isOwn = !!person && person.id === user?.id;
    const ads = state.ads.filter((ad) => person?.role === "profissional" &&
        ad.provider === person.id &&
        ad.published);
    const reviews = state.reviews.filter((review) => review.to === person?.id);
    const selectedTab = tab || (person?.role === "profissional" ? "Anúncios" : "Avaliações");
    const blocked = !!person &&
        !!user &&
        (!!state.blocked[user.id]?.includes(person.id) ||
            !!state.blocked[person.id]?.includes(user.id));
    const category = [...new Set(ads.map((ad) => ad.category))].join(" · ");
    function schedule() {
        if (!person || blocked)
            return;
        if (isOwn)
            go("calendario");
        else if (ads.length === 1) {
            go(user?.role === "profissional" ? "anuncio" : "solicitar-servico", ads[0].id);
        }
        else {
            setMenu("services");
        }
    }
    const header = isOwn ? (<View style={styles.ownHeader}>
      <Txt style={{ flex: 1, fontSize: 18, fontWeight: "700" }}>
        Meu perfil
      </Txt>
      <Pressable accessibilityRole="button" accessibilityLabel="Configurações do perfil" onPress={() => go("opcoes-perfil")} style={({ pressed }) => [
            styles.settingsButton,
            {
                backgroundColor: c.panel,
                borderColor: c.line,
                opacity: pressed ? 0.7 : 1,
            },
        ]}>
        <Ionicons name="settings-outline" size={19} color={c.accent} accessible={false}/>
        <Txt style={{ fontSize: 13, fontWeight: "600", flexShrink: 1 }}>
          Configurações
        </Txt>
      </Pressable>
    </View>) : null;
    return (<Shell publicPage={!own} nav header={header} contentPadding={0}>
      {!person ? (<View style={{ paddingHorizontal: 18 }}>
          <IconButton name="chevron-back" label="Voltar" onPress={back}/>
          <Empty icon="person-outline" title="Perfil indisponível" text="Esta conta não está mais disponível." action="Explorar serviços" onPress={() => go("pesquisa")}/>
        </View>) : (<View>
          <View style={[
                styles.hero,
                { minHeight: Math.min(360, Math.max(290, width * 0.85)) },
            ]}>
            <ProfilePhoto person={person} cover/>
            <LinearGradient colors={[`${brand.ink}00`, `${brand.ink}20`, `${brand.ink}ef`]} locations={[0, 0.35, 1]} style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}/>
            <View style={styles.heroToolbar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back} style={styles.coverButton}>
                <Ionicons name="arrow-back" size={22} color={brand.white} accessible={false}/>
              </Pressable>
              {!isOwn && (<Pressable accessibilityRole="button" accessibilityLabel="Opções deste perfil" onPress={() => setMenu("profile")} style={styles.coverButton}>
                  <Ionicons name="ellipsis-vertical" size={22} color={brand.white} accessible={false}/>
                </Pressable>)}
            </View>
            <View style={styles.heroDetails}>
              <Text style={styles.profileName}>{person.name}</Text>
              <Text style={styles.profileRole}>
                {person.role === "cliente"
                ? "Cliente"
                : category || "Profissional autônomo"}
              </Text>
              {person.bio ? (<Text style={styles.profileBio} numberOfLines={2}>
                  {person.bio}
                </Text>) : null}
              <View style={styles.heroActions}>
                {(isOwn || ads.length > 0) && (<Pressable accessibilityRole="button" accessibilityLabel={isOwn
                    ? "Minha agenda"
                    : user?.role === "profissional"
                        ? "Ver serviços"
                        : ads.length > 1
                            ? "Escolher serviço para marcar horário"
                            : "Marcar horário"} accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={schedule} style={[styles.heroPill, { opacity: blocked ? 0.45 : 1 }]}>
                    <Ionicons name={!isOwn && user?.role === "profissional"
                    ? "briefcase-outline"
                    : "calendar-outline"} size={16} color={brand.violet} accessible={false}/>
                    <Text style={styles.heroPillText}>
                      {isOwn
                    ? "Minha agenda"
                    : user?.role === "profissional"
                        ? "Ver serviços"
                        : "Marcar horário"}
                    </Text>
                  </Pressable>)}
                <View style={styles.heroPill}>
                  <Ionicons name="location-outline" size={16} color={brand.violet} accessible={false}/>
                  <Text style={[styles.heroPillText, { flexShrink: 1 }]}>
                    {person.city}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.profileContent}>
            <View style={styles.summary}>
              <Ionicons name={reviews.length ? "star" : "star-outline"} size={16} color={c.accent} accessible={false}/>
              <Txt style={{ fontSize: 13, fontWeight: "600" }}>
                {rating(state, person.id)}
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                {reviews.length === 1 ? "1 avaliação" : `${reviews.length} avaliações`}
              </Txt>
              {!isOwn && (<Pressable accessibilityRole="button" accessibilityLabel={`Conversar com ${person.name}`} accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={() => go("chat", person.id)} style={[styles.messageButton, { opacity: blocked ? 0.45 : 1 }]}>
                  <Ionicons name="chatbubble-outline" size={17} color={c.accent} accessible={false}/>
                  <Txt style={{ color: c.accent, fontSize: 12, fontWeight: "600" }}>
                    Conversar
                  </Txt>
                </Pressable>)}
            </View>
            {blocked && (<Txt muted style={{ fontSize: 12 }}>
                Mensagens e novas contratações indisponíveis por bloqueio.
              </Txt>)}
            <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: c.panel }]}>
              {(["Avaliações", "Anúncios"] as const).map((item) => {
                const selected = selectedTab === item;
                return (<Pressable key={item} accessibilityRole="tab" accessibilityLabel={item === "Avaliações"
                        ? `Avaliações recebidas, ${reviews.length}`
                        : `Anúncios publicados, ${ads.length}`} accessibilityState={{ selected }} onPress={() => setTab(item)} style={styles.tab}>
                    {selected && (<LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[
                            StyleSheet.absoluteFill,
                            { borderRadius: 16, pointerEvents: "none" },
                        ]}/>)}
                    {selected && (<Ionicons name="checkmark" size={16} color={c.onPrimary} accessible={false}/>)}
                    <Text style={{
                        color: selected ? c.onPrimary : c.text,
                        fontSize: 13,
                        fontWeight: "600",
                        flexShrink: 1,
                        textAlign: "center",
                    }}>
                      {item}
                    </Text>
                    <Text style={{
                        color: selected ? brand.pale : c.muted,
                        fontSize: 11,
                    }}>
                      {item === "Avaliações" ? reviews.length : ads.length}
                    </Text>
                  </Pressable>);
            })}
            </View>
            {selectedTab === "Avaliações" ? (reviews.length ? (reviews.map((review) => (<ReviewRow key={review.id} review={review}/>))) : (<Empty icon="star-outline" title={isOwn ? "Suas avaliações ficam aqui" : "Ainda sem avaliações"} text="As avaliações recebidas aparecem após a conclusão dos serviços."/>)) : ads.length ? (ads.map((ad) => <ProfileAdRow key={ad.id} ad={ad} own={isOwn}/>)) : (<Empty icon="images-outline" title={person.role === "cliente"
                    ? "Perfil de cliente"
                    : "Sem anúncios publicados"} text={person.role === "cliente"
                    ? "Os serviços anunciados aparecem nos perfis dos profissionais."
                    : isOwn
                        ? "Publique um anúncio para apresentar seu trabalho."
                        : "Os próximos serviços deste profissional aparecerão aqui."} action={isOwn && person.role === "profissional"
                    ? "Criar anúncio"
                    : undefined} onPress={() => go("criar-anuncio")}/>)}
            {isOwn && person.role === "profissional" && ads.length > 0 && (<Button title="Gerenciar meus anúncios" icon="create-outline" secondary onPress={() => go("meus-anuncios")}/>)}
          </View>
        </View>)}
      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <View style={styles.menuOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel={menu === "services" ? "Fechar seleção de serviço" : "Fechar opções do perfil"} onPress={() => setMenu(null)} style={StyleSheet.absoluteFill}/>
          <View style={[styles.menuPanel, { backgroundColor: c.card }]}>
            {menu === "services" && (<>
                <Title>Escolha um serviço</Title>
                <ScrollView style={{ maxHeight: 400, flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
                  {ads.map((ad) => (<MenuItem key={ad.id} title={ad.title} subtitle={money(ad.price)} icon="calendar-outline" onPress={() => {
                    setMenu(null);
                    go(user?.role === "profissional"
                        ? "anuncio"
                        : "solicitar-servico", ad.id);
                }}/>))}
                </ScrollView>
              </>)}
            {menu === "profile" && (<>
                <Title>Opções do perfil</Title>
                {[
                {
                    title: "Conversar",
                    icon: "chatbubble-outline" as const,
                    route: "chat",
                },
                {
                    title: "Denunciar perfil",
                    icon: "flag-outline" as const,
                    route: "denunciar",
                },
                {
                    title: "Gerenciar bloqueio",
                    icon: "ban-outline" as const,
                    route: "bloquear",
                },
            ]
                .filter((item) => item.route !== "chat" || !blocked)
                .map((item) => (<MenuItem key={item.route} title={item.title} icon={item.icon} onPress={() => {
                    setMenu(null);
                    if (person)
                        go(item.route, person.id);
                }}/>))}
              </>)}
            <Button title="Fechar" secondary onPress={() => setMenu(null)}/>
          </View>
        </View>
      </Modal>
    </Shell>);
}
export function OwnProfileScreen() {
    return <ProfileView own/>;
}
export function PublicProfileScreen() {
    const { id } = useLocalSearchParams<{
        id?: string;
    }>();
    return <ProfileView personId={typeof id === "string" ? id : undefined}/>;
}
const styles = StyleSheet.create({
    ownHeader: {
        minHeight: 64,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    settingsButton: {
        minHeight: 44,
        paddingHorizontal: 13,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    hero: {
        marginHorizontal: 12,
        borderRadius: 28,
        overflow: "hidden",
        justifyContent: "space-between",
        backgroundColor: brand.heroGradient[0],
    },
    photoFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    thumbnail: {
        width: 68,
        height: 76,
        borderRadius: 15,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    examplePhoto: {
        position: "absolute",
        top: 18,
        left: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: `${brand.ink}99`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9,
    },
    exampleThumbnail: {
        position: "absolute",
        bottom: 3,
        left: 3,
        padding: 3,
        borderRadius: 5,
        backgroundColor: `${brand.ink}bb`,
    },
    exampleText: { color: brand.white, fontSize: 9 },
    heroToolbar: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 10,
    },
    coverButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `${brand.ink}80`,
        alignItems: "center",
        justifyContent: "center",
    },
    heroDetails: {
        paddingHorizontal: 18,
        paddingBottom: 16,
        paddingTop: 36,
        gap: 5,
    },
    profileName: {
        color: brand.white,
        fontSize: 32,
        lineHeight: 37,
        fontWeight: "700",
        letterSpacing: -0.6,
    },
    profileRole: { color: brand.pale, fontSize: 13, fontWeight: "600" },
    profileBio: { color: brand.pale, fontSize: 12, lineHeight: 17 },
    heroActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 7,
        marginTop: 10,
    },
    heroPill: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        maxWidth: "100%",
        paddingHorizontal: 12,
        gap: 6,
        backgroundColor: brand.pale,
        borderRadius: 12,
    },
    heroPillText: { color: brand.ink, fontSize: 12, fontWeight: "600" },
    profileContent: { paddingHorizontal: 18, paddingTop: 10, gap: 10 },
    summary: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 7,
        rowGap: 3,
        minHeight: 44,
    },
    messageButton: {
        marginLeft: "auto",
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 7,
    },
    tabs: { flexDirection: "row", padding: 4, borderRadius: 20, gap: 4 },
    tab: {
        flex: 1,
        minHeight: 46,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingHorizontal: 7,
    },
    listRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowContent: { flex: 1, gap: 4, minWidth: 0 },
    adLink: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
    },
    stars: { flexDirection: "row", gap: 3 },
    menuOverlay: {
        flex: 1,
        backgroundColor: `${brand.ink}b3`,
        justifyContent: "center",
        padding: 24,
    },
    menuPanel: {
        width: "100%",
        maxWidth: 440,
        maxHeight: "85%",
        alignSelf: "center",
        borderRadius: 24,
        padding: 20,
        gap: 12,
    },
});
