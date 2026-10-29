import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, useLocalSearchParams, usePathname, } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TextInputProps, TextStyle, View, } from "react-native";
import { SafeAreaView, useSafeAreaInsets, } from "react-native-safe-area-context";
import { Ad, money, rating } from "./domain";
import { useStore } from "./store";
import { LogoMark } from "./brand";
import { brand, dark, light } from "./theme";
export { dark, light } from "./theme";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export const categoryIcons: Record<string, IconName> = {
    Todos: "grid-outline",
    Design: "color-palette-outline",
    Elétrica: "flash-outline",
    Limpeza: "sparkles-outline",
    Beleza: "cut-outline",
    Reformas: "hammer-outline",
    Tecnologia: "laptop-outline",
};
const servicePhotos: Record<string, number> = {
    Design: require("../assets/images/services/design.jpg"),
    Elétrica: require("../assets/images/services/eletrica.jpg"),
    Limpeza: require("../assets/images/services/limpeza.jpg"),
    Beleza: require("../assets/images/services/beleza.jpg"),
};
export function useColors() {
    return useStore().state.theme === "dark" ? dark : light;
}
function AccentFill() {
    const c = useColors();
    return (<LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
        }}/>);
}
export function go(path: string, id?: string, extra: Record<string, string> = {}) {
    router.push({
        pathname: ("/" + path) as any,
        params: { ...(id ? { id } : {}), ...extra },
    });
}
export function back() {
    if (router.canGoBack())
        router.back();
    else
        router.replace("/");
}
export function Txt({ children, muted, style, numberOfLines, }: {
    children: React.ReactNode;
    muted?: boolean;
    style?: TextStyle | TextStyle[];
    numberOfLines?: number;
}) {
    const c = useColors();
    return (<Text numberOfLines={numberOfLines} style={[
            { color: muted ? c.muted : c.text, fontSize: 14, lineHeight: 21 },
            style,
        ]}>
      {children}
    </Text>);
}
export function Title({ children }: {
    children: React.ReactNode;
}) {
    return (<Txt style={{ fontSize: 23, lineHeight: 30, fontWeight: "700" }}>
      {children}
    </Txt>);
}
export function Section({ title, children, }: {
    title: string;
    children?: React.ReactNode;
}) {
    return (<View style={{ gap: 12, marginTop: 8 }}>
      <Txt style={{ fontSize: 17, fontWeight: "700" }}>{title}</Txt>
      {children}
    </View>);
}
export function Card({ children }: {
    children: React.ReactNode;
}) {
    const c = useColors();
    return (<View style={{
            backgroundColor: c.card,
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
            gap: 12,
        }}>
      {children}
    </View>);
}
export function Row({ children }: {
    children: React.ReactNode;
}) {
    return (<View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
        }}>
      {children}
    </View>);
}
export function InfoRow({ icon, children, }: {
    icon: IconName;
    children: React.ReactNode;
}) {
    const c = useColors();
    return (<View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Ionicons name={icon} size={18} color={c.accent} accessible={false}/>
      <View style={{ flex: 1, gap: 3 }}>{children}</View>
    </View>);
}
export function IconTile({ icon, label, value, }: {
    icon: IconName;
    label: string;
    value?: string | number;
}) {
    const c = useColors();
    return (<View style={{
            flexGrow: 1,
            flexBasis: 110,
            borderRadius: 16,
            backgroundColor: c.panel,
            padding: 14,
            gap: 8,
        }}>
      <Ionicons name={icon} size={25} color={c.accent} accessible={false}/>
      {value !== undefined && (<Txt style={{ fontSize: 22, lineHeight: 28, fontWeight: "700" }}>
          {value}
        </Txt>)}
      <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
        {label}
      </Txt>
    </View>);
}
export function MenuItem({ title, subtitle, icon, onPress, }: {
    title: string;
    subtitle?: string;
    icon: IconName;
    onPress: () => void;
}) {
    const c = useColors();
    return (<Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 13,
            minHeight: 60,
            borderRadius: 16,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            opacity: pressed ? 0.7 : 1,
        })}>
      <View style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: c.panel,
            alignItems: "center",
            justifyContent: "center",
        }}>
        <Ionicons name={icon} size={21} color={c.accent} accessible={false}/>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: "600" }}>{title}</Txt>
        {subtitle && (<Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
            {subtitle}
          </Txt>)}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} accessible={false}/>
    </Pressable>);
}
export function VisualSteps({ steps, active, }: {
    steps: {
        icon: IconName;
        title: string;
        text?: string;
    }[];
    active?: number;
}) {
    const c = useColors();
    return (<View style={{ gap: 0 }}>
      {steps.map((step, index) => {
            const done = active !== undefined && index < active;
            const current = index === active;
            return (<View key={step.title} style={{ flexDirection: "row", gap: 13 }}>
            <View style={{ alignItems: "center", width: 40 }}>
              <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: current ? c.primary : c.panel,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: current || done ? c.accent : c.line,
                }}>
                <Ionicons name={done ? "checkmark" : step.icon} size={21} color={current ? "#fff" : done ? c.success : c.accent} accessible={false}/>
              </View>
              {index < steps.length - 1 && (<View style={{
                        width: 2,
                        minHeight: 14,
                        flex: 1,
                        backgroundColor: done ? c.success : c.line,
                        marginVertical: 4,
                    }}/>)}
            </View>
            <View style={{
                    flex: 1,
                    paddingTop: 2,
                    paddingBottom: index < steps.length - 1 ? 18 : 0,
                    gap: 3,
                }}>
              <Txt style={{ fontWeight: "700" }}>
                {step.title}{done ? " · Concluído" : current ? " · Agora" : ""}
              </Txt>
              {step.text && (<Txt muted style={{ fontSize: 13, lineHeight: 19 }}>
                  {step.text}
                </Txt>)}
            </View>
          </View>);
        })}
    </View>);
}
export function ServiceImage({ category, uri, height = 180, }: {
    category: string;
    uri?: string;
    height?: number;
}) {
    const c = useColors();
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [uri]);
    const source = uri && !failed ? { uri } : servicePhotos[category];
    const example = !uri || failed;
    return (<View style={{
            height,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: c.panel,
        }}>
      {source ? (<Image source={source} resizeMode="cover" onError={() => {
                if (uri)
                    setFailed(true);
            }} accessible accessibilityRole="image" accessibilityLabel={example
                ? `Imagem ilustrativa de ${category}`
                : `Foto do serviço de ${category}`} style={{ width: "100%", height: "100%" }}/>) : (<LinearGradient colors={brand.heroGradient} style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
            }}>
          <Ionicons name={categoryIcons[category] || "construct-outline"} size={54} color={brand.pale} accessible={false}/>
          <Text style={{ color: brand.pale, fontWeight: "700", fontSize: 16 }}>
            {category}
          </Text>
        </LinearGradient>)}
      {example && source && (<View style={{
                position: "absolute",
                left: 10,
                bottom: 10,
                backgroundColor: brand.ink + "dd",
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 9,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
            }}>
          <Ionicons name="images-outline" size={12} color="#fff" accessible={false}/>
          <Text style={{ color: "#fff", fontSize: 10 }}>Imagem ilustrativa</Text>
        </View>)}
    </View>);
}
export function CategoryPicker({ items, value, onChange, }: {
    items: string[];
    value: string;
    onChange: (value: string) => void;
}) {
    const c = useColors();
    return (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
      {items.map((item) => (<Pressable key={item} accessibilityRole="button" accessibilityLabel={item} accessibilityState={{ selected: value === item }} onPress={() => onChange(item)} style={({ pressed }) => ({
                width: 78,
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
            })}>
          <View style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                backgroundColor: value === item ? c.primary : c.panel,
                borderWidth: 1,
                borderColor: value === item ? c.accent : c.line,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}>
            {value === item && <AccentFill />}
            <Ionicons name={categoryIcons[item] || "grid-outline"} size={27} color={value === item ? c.onPrimary : c.accent} accessible={false}/>
          </View>
          <Txt style={{
                fontSize: 11,
                lineHeight: 17,
                fontWeight: value === item ? "700" : "500",
                color: value === item ? c.accent : c.muted,
            }}>
            {item}
          </Txt>
        </Pressable>))}
    </ScrollView>);
}
export function QuickAction({ icon, label, onPress, }: {
    icon: IconName;
    label: string;
    onPress: () => void;
}) {
    const c = useColors();
    return (<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({
            flex: 1,
            minWidth: 78,
            alignItems: "center",
            paddingVertical: 16,
            gap: 9,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 18,
            opacity: pressed ? 0.7 : 1,
        })}>
      <Ionicons name={icon} size={25} color={c.accent} accessible={false}/>
      <Txt style={{ fontSize: 12, fontWeight: "600" }}>{label}</Txt>
    </Pressable>);
}
export function Button({ title, onPress, secondary, danger, disabled, icon, }: {
    title: string;
    onPress: () => void;
    secondary?: boolean;
    danger?: boolean;
    disabled?: boolean;
    icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
    const c = useColors();
    return (<Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({ pressed }) => ({
            minHeight: 46,
            maxWidth: "100%",
            flexGrow: 0,
            flexShrink: 0,
            paddingHorizontal: 17,
            paddingVertical: 12,
            borderRadius: 24,
            backgroundColor: secondary ? c.panel : danger ? c.dangerFill : c.primary,
            overflow: "hidden",
            borderWidth: secondary ? 1 : 0,
            borderColor: c.line,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            flexDirection: "row",
            gap: 7,
            justifyContent: "center",
            alignItems: "center",
        })}>
      {!secondary && !danger && <AccentFill />}
      {icon && (<Ionicons name={icon} size={18} color={secondary ? c.accent : c.onPrimary} accessible={false}/>)}
      <Text style={{
            color: secondary ? c.text : c.onPrimary,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: "600",
            flexShrink: 1,
            textAlign: "center",
        }}>
        {title}
      </Text>
    </Pressable>);
}
export function IconButton({ name, label, onPress, color, }: {
    name: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress: () => void;
    color?: string;
}) {
    const c = useColors();
    return (<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
        }}>
      <Ionicons name={name} size={23} color={color || c.text}/>
    </Pressable>);
}
export function Field({ label, icon, trailingAction, ...props }: TextInputProps & {
    label: string;
    icon?: IconName;
    trailingAction?: React.ReactNode;
}) {
    const c = useColors();
    return (<View style={{ gap: 7 }}>
      {icon ? (<InfoRow icon={icon}>
          <Txt style={{ fontWeight: "600", fontSize: 13 }}>{label}</Txt>
        </InfoRow>) : (<Txt style={{ fontWeight: "600", fontSize: 13 }}>{label}</Txt>)}
      <View>
        <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} {...props} style={[
            {
                color: c.text,
                backgroundColor: c.panel,
                borderColor: c.controlLine,
                borderWidth: 1,
                borderRadius: 12,
                padding: 13,
                fontSize: 15,
                minHeight: 48,
                textAlignVertical: props.multiline ? "top" : "center",
            },
            props.multiline && { minHeight: 96 },
            props.style,
            trailingAction ? { paddingRight: 54 } : undefined,
        ]}/>
        {trailingAction && (<View style={{
                position: "absolute",
                right: 5,
                top: 0,
                bottom: 0,
                justifyContent: "center",
            }}>
            {trailingAction}
          </View>)}
      </View>
    </View>);
}
export function Chips({ items, value, onChange, icons, }: {
    items: string[];
    value: string;
    onChange: (v: string) => void;
    icons?: Record<string, IconName>;
}) {
    const c = useColors();
    return (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{
            gap: 8,
            paddingVertical: 3,
            alignItems: "center",
        }}>
      {items.map((item) => (<Pressable key={item} accessibilityRole="button" accessibilityLabel={item} accessibilityState={{ selected: item === value }} onPress={() => onChange(item)} style={{
                minHeight: 44,
                flexGrow: 0,
                flexShrink: 0,
                alignSelf: "center",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 7,
                paddingHorizontal: 15,
                paddingVertical: 11,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: item === value ? c.primary : c.line,
                backgroundColor: item === value ? c.primary : c.panel,
                overflow: "hidden",
            }}>
          {item === value && <AccentFill />}
          {icons?.[item] && (<Ionicons name={icons[item]} size={17} color={item === value ? c.onPrimary : c.accent} accessible={false}/>)}
          <Text style={{
                color: item === value ? c.onPrimary : c.text,
                fontSize: 13,
                lineHeight: 18,
                textAlign: "center",
            }}>
            {item}
          </Text>
        </Pressable>))}
    </ScrollView>);
}
export function Badge({ text }: {
    text: string;
}) {
    const c = useColors();
    const symbols: Record<string, IconName> = {
        "Aguardando aceite": "hourglass-outline",
        "Aguardando pagamento": "card-outline",
        Agendado: "calendar-outline",
        "Confirmar entrega": "cube-outline",
        Concluído: "checkmark-circle-outline",
        "Serviço concluído": "checkmark-circle-outline",
        Cancelado: "close-circle-outline",
        Recusado: "close-circle-outline",
        "Em contestação": "alert-circle-outline",
        "Não pago": "card-outline",
        "Em custódia": "lock-closed-outline",
        Liberado: "checkmark-circle-outline",
        Reembolsado: "return-down-back-outline",
        "Bloqueado para análise": "shield-outline",
        Publicado: "eye-outline",
        Rascunho: "document-outline",
    };
    return (<View style={{
            alignSelf: "flex-start",
            backgroundColor: c.panel,
            borderRadius: 8,
            paddingHorizontal: 9,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
        }}>
      {symbols[text] && (<Ionicons name={symbols[text]} size={14} color={c.accent} accessible={false}/>)}
      <Txt style={{ fontSize: 12, color: c.accent, fontWeight: "600" }}>
        {text}
      </Txt>
    </View>);
}
export function Empty({ title, text, action, onPress, icon = "sparkles-outline", }: {
    title: string;
    text: string;
    action?: string;
    onPress?: () => void;
    icon?: IconName;
}) {
    const c = useColors();
    return (<View style={{ alignItems: "center", paddingVertical: 30, gap: 12 }}>
      <View style={{
            width: 108,
            height: 96,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 6,
        }}>
        <View style={{
            position: "absolute",
            width: 86,
            height: 86,
            borderRadius: 30,
            backgroundColor: c.panel,
            transform: [{ rotate: "-10deg" }],
            borderWidth: 1,
            borderColor: c.line,
        }}/>
        <Ionicons name={icon} size={42} color={c.accent} accessible={false}/>
        <View style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 29,
            height: 29,
            borderRadius: 12,
            backgroundColor: c.primary,
            alignItems: "center",
            justifyContent: "center",
        }}>
          <Ionicons name="sparkles" size={15} color="#fff" accessible={false}/>
        </View>
      </View>
      <Txt style={{ fontSize: 17, fontWeight: "700", textAlign: "center" }}>
        {title}
      </Txt>
      <Txt muted style={{ textAlign: "center" }}>
        {text}
      </Txt>
      {action && onPress && <Button title={action} onPress={onPress}/>}
    </View>);
}
export function Avatar({ name, uri, size = 44, }: {
    name: string;
    uri?: string;
    size?: number;
}) {
    return uri ? (<Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }}/>) : (<View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: brand.violet,
            alignItems: "center",
            justifyContent: "center",
        }}>
      <Text style={{ color: brand.pale, fontSize: size / 3, fontWeight: "700" }}>
        {name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
      </Text>
    </View>);
}
export function Brand() {
    return (<Row>
      <LogoMark size={36}/>
      <Txt style={{ fontSize: 26, fontWeight: "700", letterSpacing: 0.6 }}>
        tasker
      </Txt>
    </Row>);
}
export function Confirm({ visible, title, text, onConfirm, onClose, }: {
    visible: boolean;
    title: string;
    text: string;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const c = useColors();
    return (<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
            flex: 1,
            backgroundColor: "#000a",
            justifyContent: "center",
            padding: 24,
        }}>
        <View style={{
            backgroundColor: c.card,
            borderRadius: 22,
            padding: 24,
            gap: 16,
            width: "100%",
            maxWidth: 440,
            alignSelf: "center",
        }}>
          <Title>{title}</Title>
          <Txt>{text}</Txt>
          <Button title="Confirmar" danger onPress={() => {
            onClose();
            onConfirm();
        }}/>
          <Button title="Voltar" secondary onPress={onClose}/>
        </View>
      </View>
    </Modal>);
}
export function Shell({ title, children, publicPage = false, nav = false, scroll = true, action, header, contentPadding = 18, }: {
    title?: string;
    children: React.ReactNode;
    publicPage?: boolean;
    nav?: boolean;
    scroll?: boolean;
    action?: React.ReactNode;
    header?: React.ReactNode;
    contentPadding?: number;
}) {
    const c = useColors(), { user, connectionError, sync, run } = useStore(), path = usePathname(), params = useLocalSearchParams();
    if (!publicPage && !user)
        return (<Redirect href={{
                pathname: "/login",
                params: {
                    next: path,
                    id: typeof params.id === "string" ? params.id : "",
                },
            } as any}/>);
    return (<SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={nav ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]}>
      {connectionError && <View style={{padding:12,gap:5,backgroundColor:c.panel}}>
        <Txt numberOfLines={2}>{connectionError}</Txt><Button title="Atualizar conexão" secondary onPress={()=>run(sync)}/>
      </View>}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, width: "100%", maxWidth: 680, alignSelf: "center" }}>
          {header !== undefined ? (header) : (<View style={{
                minHeight: 68,
                paddingHorizontal: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
            }}>
              {title ? (<>
                  <IconButton name="chevron-back" label="Voltar" onPress={back}/>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontSize: 19, fontWeight: "700" }}>{title}</Txt>
                  </View>
                </>) : (<View style={{ flex: 1, paddingLeft: 7 }}>
                  <Brand />
                </View>)}
              <IconButton name="refresh-outline" label="Atualizar dados" onPress={()=>run(sync)}/>
              {action}
            </View>)}
          {scroll ? (<ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{
                paddingHorizontal: contentPadding,
                paddingTop: 4,
                paddingBottom: nav ? 24 : 46,
                gap: 16,
                flexGrow: 1,
            }}>
              {children}
            </ScrollView>) : (<View style={{ flex: 1, paddingHorizontal: contentPadding, gap: 12 }}>
              {children}
            </View>)}
          {nav ? <Navigation /> : <View style={{ height: 16 }}/>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>);
}
function Navigation() {
    const c = useColors(), path = usePathname(), { user } = useStore(), inset = useSafeAreaInsets(), [menu, setMenu] = useState(false);
    const activePath = ["/perfil-profissional", "/opcoes-perfil"].includes(path)
        ? "/perfil"
        : path;
    const items = [
        { path: "/", icon: "home-outline", label: "Início" },
        { path: "/pesquisa", icon: "search", label: "Buscar" },
        { path: "+", icon: "add", label: "Ações" },
        { path: "/lista-de-chats", icon: "chatbubble-outline", label: "Conversas" },
        { path: "/perfil", icon: "person-outline", label: "Perfil" },
    ] as const;
    return (<>
      <View style={{
            marginHorizontal: 12,
            marginTop: 7,
            marginBottom: Math.max(10, inset.bottom),
            backgroundColor: c.panel,
            borderRadius: 23,
            paddingVertical: 8,
            flexDirection: "row",
            justifyContent: "space-around",
            borderWidth: 1,
            borderColor: c.line,
        }}>
        {items.map((item) => (<Pressable key={item.path} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: activePath === item.path }} onPress={() => item.path === "+"
                ? setMenu(true)
                : router.navigate(item.path as any)} style={{ alignItems: "center", gap: 4, minWidth: 48, padding: 5 }}>
            <View style={{
                width: 34,
                height: 34,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                overflow: "hidden",
                backgroundColor: item.path === "+"
                    ? c.primary
                    : activePath === item.path ? c.tint : "transparent",
            }}>
              {item.path === "+" && <AccentFill />}
              <Ionicons name={item.icon} size={23} color={item.path === "+"
                ? c.onPrimary
                : activePath === item.path
                    ? c.blue
                    : c.muted}/>
            </View>
            <Txt style={{
                fontSize: 10,
                lineHeight: 13,
                color: activePath === item.path ? c.blue : c.muted,
            }}>
              {item.label}
            </Txt>
          </Pressable>))}
      </View>
      <Modal visible={menu} transparent animationType="slide" onRequestClose={() => setMenu(false)}>
        <View style={{
            flex: 1,
            backgroundColor: "#0009",
            justifyContent: "flex-end",
        }}>
          <Pressable accessibilityLabel="Fechar ações" onPress={() => setMenu(false)} style={{ flex: 1 }}/>
          <View style={{
            backgroundColor: c.panel,
            padding: 24,
            paddingBottom: Math.max(24, inset.bottom),
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            gap: 12,
            maxWidth: 680,
            width: "100%",
            alignSelf: "center",
        }}>
            <Title>O que vamos fazer?</Title>
            {[
            ...(user?.role === "profissional"
                ? [["Criar anúncio", "criar-anuncio", "add-circle-outline"]]
                : [["Encontrar um serviço", "pesquisa", "search-outline"]]),
            ["Minha agenda", "calendario", "calendar-outline"],
            ["Meus serviços", "meus-servicos", "briefcase-outline"],
            ["Favoritos", "favoritos", "heart-outline"],
            ["Carteira", "carteira", "wallet-outline"],
        ].map(([label, route, icon]) => (<MenuItem key={route} title={label} icon={icon as IconName} onPress={() => {
                setMenu(false);
                go(route);
            }}/>))}
            <Button title="Fechar" onPress={() => setMenu(false)}/>
          </View>
        </View>
      </Modal>
    </>);
}
export function AdCard({ ad, compact = false }: {
    ad: Ad;
    compact?: boolean;
}) {
    const { state, user, act, run } = useStore(), c = useColors(), person = state.users.find((u) => u.id === ad.provider), saved = user && state.favorites[user.id]?.includes(ad.id);
    return (<Card>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Pressable onPress={() => go("perfil-profissional", ad.provider)} accessibilityRole="button" accessibilityLabel={`Ver perfil de ${person?.name}`} style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        }}>
          <Avatar name={person?.name || "Perfil"} uri={person?.avatar}/>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: "700" }}>
              {person?.name || "Perfil removido"}
            </Txt>
            <Txt muted style={{ fontSize: 12 }}>
              {ad.category} · {ad.city}
            </Txt>
          </View>
        </Pressable>
        <IconButton name={saved ? "heart" : "heart-outline"} color={saved ? "#ef4444" : c.muted} label={saved ? "Remover favorito" : "Favoritar"} onPress={async () => user ? await run(async () => await act({ type: "favorite", id: ad.id })) : go("login")}/>
      </View>
      <Pressable onPress={() => go("anuncio", ad.id)} accessibilityRole="button" accessibilityLabel={`Ver anúncio: ${ad.title}`} style={{ gap: 10 }}>
        <ServiceImage category={ad.category} uri={ad.images[0]} height={compact ? 160 : 210}/>
        <Txt style={{ fontSize: 17, fontWeight: "700" }}>{ad.title}</Txt>
        <Txt muted numberOfLines={compact ? 2 : undefined}>{ad.description}</Txt>
        {!compact && ad.images.length > 1 && (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {ad.images.slice(1).map((uri, i) => (<View key={uri + i} style={{ width: 220 }}>
                <ServiceImage category={ad.category} uri={uri} height={130}/>
              </View>))}
          </ScrollView>)}
        <Row>
          <Txt style={{ fontSize: 18, fontWeight: "700", color: c.accent }}>
            {money(ad.price)}
          </Txt>
          <Ionicons name="star" size={15} color={c.accent} accessible={false}/>
          <Txt muted>{rating(state, ad.provider)}</Txt>
        </Row>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={user?.id === ad.provider ? "Editar anúncio" : "Ver serviço"} icon={user?.id === ad.provider ? "create-outline" : "arrow-forward"} onPress={() => go(user?.id === ad.provider ? "criar-anuncio" : "anuncio", ad.id)}/>
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Mensagem" secondary icon="chatbubble-outline" onPress={() => user?.id === ad.provider
            ? go("lista-de-chats")
            : go("chat", ad.provider)}/>
        </View>
      </View>
    </Card>);
}
