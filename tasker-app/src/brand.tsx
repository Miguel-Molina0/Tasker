import React from "react";
import { Image, View } from "react-native";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logo Tasker"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        overflow: "hidden",
        backgroundColor: "#000000",
        flexShrink: 0,
      }}
    >
      {/* Frame the icon from the original 1049 x 1441 artwork without editing it. */}
      <Image
        source={require("../assets/images/brand/logo-tasker.png")}
        accessible={false}
        resizeMode="stretch"
        style={{
          position: "absolute",
          width: size * (1049 / 640),
          height: size * (1441 / 640),
          left: -size * (200 / 640),
          top: -size * (310 / 640),
        }}
      />
    </View>
  );
}
