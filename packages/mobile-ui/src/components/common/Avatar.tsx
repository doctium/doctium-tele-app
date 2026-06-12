import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gradients, Fonts, useColors } from "../../theme";

interface Props {
  uri?: string;
  name?: string;
  size?: number;
  ring?: boolean;
  style?: ViewStyle;
}

export function Avatar({ uri, name, size = 44, ring, style }: Props) {
  const colors = useColors();
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const inner = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.navy,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={Gradients.aurora}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { alignItems: "center", justifyContent: "center" },
          ]}
        >
          <Text
            style={{
              color: "#fff",
              fontFamily: Fonts.bold,
              fontSize: size * 0.38,
              letterSpacing: -0.3,
            }}
          >
            {initials}
          </Text>
        </LinearGradient>
      )}
    </View>
  );

  if (ring) {
    return (
      <LinearGradient
        colors={Gradients.teal}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: 999, padding: 2.5 }, style]}
      >
        <View
          style={{
            borderRadius: 999,
            padding: 2,
            backgroundColor: colors.surface,
          }}
        >
          {inner}
        </View>
      </LinearGradient>
    );
  }

  return <View style={style}>{inner}</View>;
}
