import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Palette,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { LANGUAGES } from "../../../src/i18n/languages";
import { setAppLanguage } from "../../../src/i18n";
import { usersApi } from "../../../src/api/users.api";

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState(i18n.language);
  const styles = useThemedStyles(makeStyles);

  const choose = async (code: string) => {
    if (code === selected) return;
    setSelected(code);
    await setAppLanguage(code);
    // Best-effort: persist the choice to the account for cross-device + future
    // language-aware notifications. The local choice is the source of truth.
    usersApi.updateProfile({ preferredLanguage: code }).catch(() => {});
  };

  const enabled = LANGUAGES.filter((l) => l.enabled);
  const comingSoon = LANGUAGES.filter((l) => !l.enabled);

  return (
    <View style={styles.root}>
      <AppHeader title={t("language.title")} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>{t("language.subtitle")}</Text>

        <View style={styles.card}>
          {enabled.map((l, idx) => {
            const active = selected === l.code;
            return (
              <AnimatedPressable
                key={l.code}
                haptic="light"
                onPress={() => choose(l.code)}
                style={[
                  styles.row,
                  idx < enabled.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.native}>{l.native}</Text>
                  {l.native !== l.label ? (
                    <Text style={styles.label}>{l.label}</Text>
                  ) : null}
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

        <Text style={styles.note}>{t("language.note")}</Text>

        <Text style={styles.sectionLabel}>{t("language.comingSoon")}</Text>
        <View style={styles.card}>
          {comingSoon.map((l, idx) => (
            <View
              key={l.code}
              style={[
                styles.row,
                idx < comingSoon.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.native, styles.dim]}>{l.native}</Text>
                <Text style={styles.label}>{l.label}</Text>
              </View>
              <View style={styles.soonPill}>
                <Text style={styles.soonText}>{t("language.comingSoon")}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 48 },
    subtitle: {
      ...Type.body,
      color: c.text.secondary,
      marginBottom: 18,
    },
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
      gap: 12,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    native: { ...Type.bodyMed, color: c.text.primary },
    label: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    dim: { color: c.text.secondary },
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
    note: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 14,
      marginBottom: 26,
      marginHorizontal: 4,
      lineHeight: 18,
    },
    sectionLabel: {
      ...Type.overline,
      color: c.text.tertiary,
      marginBottom: 10,
      marginLeft: 4,
    },
    soonPill: {
      backgroundColor: c.navySoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    soonText: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      color: c.navy,
    },
  });
