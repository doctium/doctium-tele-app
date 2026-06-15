import React from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../ui";
import { Palette, Shadow, useThemedStyles } from "../../theme";

/**
 * Global "Talk to Leenah" button — reachable from any authenticated screen.
 * Opens Leenah in hands-free voice mode (greets aloud + starts listening).
 */
export function LeenahFab() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const pathname = usePathname();

  // Don't float over Leenah itself.
  if (pathname?.includes("triage")) return null;

  return (
    <AnimatedPressable
      haptic="medium"
      onPress={() => router.push("/(app)/(triage)?voice=1" as never)}
      style={[styles.fab, { bottom: insets.bottom + 92 }]}
      accessibilityLabel="Talk to Leenah"
    >
      <Ionicons name="mic" size={24} color="#fff" />
    </AnimatedPressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    fab: {
      position: "absolute",
      right: 18,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.teal,
      ...Shadow.cta,
    },
  });
