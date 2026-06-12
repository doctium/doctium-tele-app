import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Fonts, Radius, Palette, useColors } from "../../theme";

type Variant =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "online"
  | "info";

const makeVariantMap = (
  c: Palette,
): Record<
  Variant,
  { bg: string; text: string; dot: string; label: string }
> => ({
  pending: {
    bg: c.warningSoft,
    text: "#B86A00",
    dot: c.warning,
    label: "Pending",
  },
  confirmed: {
    bg: c.skySoft,
    text: c.navyMid,
    dot: c.skyDeep,
    label: "Confirmed",
  },
  completed: {
    bg: c.successSoft,
    text: "#0B7A47",
    dot: c.success,
    label: "Completed",
  },
  cancelled: {
    bg: c.errorSoft,
    text: c.error,
    dot: c.error,
    label: "Cancelled",
  },
  online: {
    bg: c.tealSoft,
    text: c.tealDeep,
    dot: c.teal,
    label: "Available now",
  },
  info: { bg: c.navySoft, text: c.navyMid, dot: c.navyMid, label: "" },
});

interface Props {
  variant: Variant;
  label?: string;
  dot?: boolean;
  style?: ViewStyle;
}

export function Badge({ variant, label, dot = true, style }: Props) {
  const colors = useColors();
  const c = makeVariantMap(colors)[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.dot }]} />}
      <Text style={[styles.text, { color: c.text }]}>{label ?? c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.round,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: Fonts.semibold, letterSpacing: -0.1 },
});
