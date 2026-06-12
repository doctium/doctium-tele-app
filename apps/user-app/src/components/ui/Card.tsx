import React from "react";
import { View, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Radius, Shadow, Space, useColors } from "../../theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  elevation?: keyof typeof Shadow;
}

/** Solid surface card with soft brand-tinted depth and a hairline edge. */
export function Card({
  children,
  style,
  padding = Space.xl,
  radius = Radius.xl,
  elevation = "card",
}: CardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius,
          padding,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        },
        Shadow[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface GlassProps extends CardProps {
  intensity?: number;
  tint?: "light" | "dark" | "default";
}

/** Frosted-glass card. Best layered over gradients, imagery, or the canvas. */
export function GlassCard({
  children,
  style,
  padding = Space.xl,
  radius = Radius.xl,
  intensity = 36,
  tint = "light",
}: GlassProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor:
            tint === "dark" ? colors.hairlineOnDark : colors.glassBorder,
        },
        Shadow.card,
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          padding,
          backgroundColor:
            tint === "dark" ? "rgba(11,23,38,0.28)" : "rgba(255,255,255,0.35)",
        }}
      >
        {children}
      </View>
    </View>
  );
}
