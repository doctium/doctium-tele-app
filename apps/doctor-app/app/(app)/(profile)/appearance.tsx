import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  ThemeMode,
  useTheme,
  useThemedStyles,
} from "../../../src/theme";
import { AppHeader, AnimatedPressable } from "../../../src/components/ui";

type IoniconName = keyof typeof Ionicons.glyphMap;

const OPTIONS: {
  mode: ThemeMode;
  icon: IoniconName;
  title: string;
  sub: string;
}[] = [
  {
    mode: "system",
    icon: "phone-portrait-outline",
    title: "Match device",
    sub: "Follow your phone's light/dark setting",
  },
  {
    mode: "light",
    icon: "sunny-outline",
    title: "Light",
    sub: "Bright, clinical canvas",
  },
  {
    mode: "dark",
    icon: "moon-outline",
    title: "Dark",
    sub: "Deep navy — easy on the eyes",
  },
];

export default function AppearanceScreen() {
  const { mode, setMode, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.root}>
      <AppHeader title="Appearance" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Choose how Doctium looks. Match device follows your phone
          automatically.
        </Text>

        <View style={styles.card}>
          {OPTIONS.map((o, idx) => {
            const active = mode === o.mode;
            return (
              <AnimatedPressable
                key={o.mode}
                haptic="light"
                onPress={() => setMode(o.mode)}
                style={[
                  styles.row,
                  idx < OPTIONS.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={o.icon} size={19} color={colors.navyMid} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{o.title}</Text>
                  <Text style={styles.sub}>{o.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? (
                    <Ionicons name="checkmark" size={15} color="#fff" />
                  ) : null}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 48 },
    subtitle: { ...Type.body, color: c.text.secondary, marginBottom: 18 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 14,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { ...Type.bodyMed, color: c.text.primary },
    sub: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    radio: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { backgroundColor: c.teal, borderColor: c.teal },
  });
