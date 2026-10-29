import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LogoMark } from "./brand";
import { brand } from "./theme";
import { back, IconButton, Shell, useColors } from "./ui";

export type AuthLayoutProps = {
  mode: "login" | "register" | "recover";
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AuthLayout({
  mode,
  title,
  subtitle,
  children,
}: AuthLayoutProps) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return (
    <Shell publicPage header={null} contentPadding={0}>
      <View style={[styles.layout, { backgroundColor: c.bg }]}>
        <LinearGradient
          colors={brand.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { minHeight: mode === "login" ? 224 : 184 }]}
        >
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
          >
            <View style={styles.outerOrbit} />
            <View style={styles.innerOrbit} />
            <LinearGradient
              colors={[`${brand.purple}66`, `${brand.violet}66`, `${brand.blue}33`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ribbon}
            />
            <LinearGradient
              colors={[`${brand.purple}55`, `${brand.lilac}0A`]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.lowerGlow}
            />
          </View>
          <View style={styles.toolbar}>
            <View style={styles.backButton}>
              <IconButton name="arrow-back" label="Voltar" color={brand.white} onPress={back} />
            </View>
            <View style={styles.brand}>
              <LogoMark size={34} />
              <Text style={styles.wordmark}>tasker</Text>
            </View>
          </View>
          {(title || subtitle) && (
            <View style={styles.heading}>
              {title && (
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.title,
                    { fontSize: compact ? 26 : 28, lineHeight: compact ? 32 : 35 },
                  ]}
                >
                  {title}
                </Text>
              )}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}
        </LinearGradient>
        <View
          style={[
            styles.panel,
            { backgroundColor: c.card, borderColor: c.line },
          ]}
        >
          <View style={[styles.panelAccent, { backgroundColor: c.tint }]} />
          {children}
        </View>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    marginTop: -4,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 46,
    overflow: "hidden",
    justifyContent: "space-between",
    gap: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: `${brand.ink}55`,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wordmark: {
    color: brand.white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  heading: {
    gap: 7,
  },
  title: {
    color: brand.white,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: brand.pale,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 420,
  },
  panel: {
    flex: 1,
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    padding: 24,
    paddingTop: 20,
    gap: 18,
  },
  panelAccent: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 2,
  },
  outerOrbit: {
    position: "absolute",
    width: 258,
    height: 258,
    top: -112,
    right: -76,
    borderRadius: 129,
    borderWidth: 42,
    borderColor: `${brand.lilac}18`,
    transform: [{ rotate: "-28deg" }, { scaleY: 0.8 }],
  },
  innerOrbit: {
    position: "absolute",
    width: 162,
    height: 162,
    top: -62,
    right: -18,
    borderRadius: 81,
    borderWidth: 1,
    borderColor: `${brand.pale}20`,
  },
  ribbon: {
    position: "absolute",
    width: 246,
    height: 86,
    top: 46,
    right: -90,
    borderRadius: 43,
    transform: [{ rotate: "-35deg" }],
  },
  lowerGlow: {
    position: "absolute",
    width: 204,
    height: 204,
    bottom: -118,
    left: -46,
    borderRadius: 102,
  },
});
