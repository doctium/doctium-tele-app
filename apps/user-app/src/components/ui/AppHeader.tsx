import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "./AnimatedPressable";
import { Txt } from "./Txt";
import { Shadow, Space, useColors } from "../../theme";

interface Props {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  light?: boolean; // place over dark/gradient backgrounds
}

/** Consistent detail-screen header: glass back button, centered title, optional right slot. */
export function AppHeader({ title, right, onBack, light }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  // `light` = over a dark gradient → white ink. Otherwise the theme's primary ink.
  const tint = light ? "#fff" : colors.text.primary;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <AnimatedPressable
        haptic="light"
        onPress={onBack ?? (() => router.back())}
        style={[
          styles.btn,
          {
            backgroundColor: light ? "rgba(255,255,255,0.16)" : colors.surface,
          },
          !light && Shadow.card,
          light && {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.22)",
          },
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={tint} />
      </AnimatedPressable>

      {title ? (
        <Txt
          variant="h3"
          color={tint}
          center
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </Txt>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Space.xl,
    paddingBottom: 8,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, marginHorizontal: 10 },
  right: { minWidth: 44, alignItems: "flex-end" },
});
