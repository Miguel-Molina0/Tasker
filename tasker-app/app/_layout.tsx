import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "../src/store";
import { dark, light } from "../src/theme";
function Routes() {
  const { state } = useStore();
  return (
    <>
      <StatusBar style={state.theme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: state.theme === "dark" ? dark.bg : light.bg,
          },
        }}
      />
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Routes />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
