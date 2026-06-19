import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { ASSISTANT_NAME } from "../../../src/constants/assistant";
import {
  LEENAH_LANGUAGES,
  getLeenahAutoPlay,
  getLeenahLanguage,
  setLeenahAutoPlay,
  setLeenahLanguage,
} from "../../../src/utils/leenahPrefs";

/**
 * Leenah settings — lets the patient shape their AI-assistant experience
 * (voice replies, default language) anytime, instead of only from the
 * pre-chat setup screen. Preferences persist via leenahPrefs.
 */
export default function LeenahSettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [autoPlay, setAutoPlay] = useState(false);
  const [language, setLanguage] = useState("auto");

  useEffect(() => {
    getLeenahAutoPlay().then(setAutoPlay);
    getLeenahLanguage().then(setLanguage);
  }, []);

  const toggleAutoPlay = () => {
    setAutoPlay((v) => {
      const next = !v;
      setLeenahAutoPlay(next);
      return next;
    });
  };

  const pickLanguage = (code: string) => {
    setLanguage(code);
    setLeenahLanguage(code);
  };

  return (
    <View style={styles.root}>
      <AppHeader title={t("triage.settings.title", { name: ASSISTANT_NAME })} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Intro */}
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={styles.intro}
        >
          <View style={styles.introIcon}>
            <Ionicons name="sparkles" size={22} color={colors.teal} />
          </View>
          <Text style={styles.introTitle}>
            {t("triage.settings.introTitle", { name: ASSISTANT_NAME })}
          </Text>
          <Text style={styles.introSub}>
            {t("triage.settings.introSub", { name: ASSISTANT_NAME })}
          </Text>
        </Animated.View>

        {/* Voice replies */}
        <Animated.View entering={FadeInDown.delay(70).springify().damping(18)}>
          <Text style={styles.groupLabel}>{t("triage.settings.voice")}</Text>
          <AnimatedPressable
            haptic="light"
            onPress={toggleAutoPlay}
            style={styles.row}
          >
            <View
              style={[
                styles.rowIcon,
                autoPlay && { backgroundColor: colors.teal },
              ]}
            >
              <Ionicons
                name={autoPlay ? "volume-high" : "volume-mute"}
                size={19}
                color={autoPlay ? "#fff" : colors.teal}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {t("triage.settings.speakBack", { name: ASSISTANT_NAME })}
              </Text>
              <Text style={styles.rowSub}>
                {t("triage.settings.speakBackSub")}
              </Text>
            </View>
            <View style={[styles.pill, autoPlay && styles.pillOn]}>
              <Text style={[styles.pillText, autoPlay && { color: "#fff" }]}>
                {autoPlay ? t("triage.settings.on") : t("triage.settings.off")}
              </Text>
            </View>
          </AnimatedPressable>
          <Text style={styles.hint}>{t("triage.settings.voiceHint")}</Text>
        </Animated.View>

        {/* Default language */}
        <Animated.View entering={FadeInDown.delay(140).springify().damping(18)}>
          <Text style={styles.groupLabel}>
            {t("triage.settings.defaultLanguage")}
          </Text>
          <View style={styles.langRow}>
            {LEENAH_LANGUAGES.map((l) => {
              const active = language === l.code;
              return (
                <AnimatedPressable
                  key={l.code}
                  haptic="light"
                  onPress={() => pickLanguage(l.code)}
                  style={[styles.langChip, active && styles.langChipSel]}
                >
                  <Text style={[styles.langText, active && { color: "#fff" }]}>
                    {l.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {t("triage.settings.languageHint", { name: ASSISTANT_NAME })}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: Space.xl, paddingTop: 6, paddingBottom: 40 },

    intro: { alignItems: "center", paddingVertical: 10, marginBottom: 6 },
    introIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    introTitle: { ...Type.h2, color: c.text.primary, textAlign: "center" },
    introSub: {
      ...Type.bodySm,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 6,
      maxWidth: "90%",
    },

    groupLabel: {
      ...Type.overline,
      color: c.text.tertiary,
      marginTop: 22,
      marginBottom: 10,
      marginLeft: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    rowSub: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    pill: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 13,
      paddingVertical: 6,
      borderRadius: Radius.round,
    },
    pillOn: { backgroundColor: c.teal, borderColor: "transparent" },
    pillText: {
      fontFamily: Fonts.bold,
      fontSize: 12.5,
      color: c.text.secondary,
    },
    hint: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 10,
      marginLeft: 4,
      lineHeight: 17,
    },

    langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    langChip: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: Radius.round,
    },
    langChipSel: { backgroundColor: c.navy, borderColor: "transparent" },
    langText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
    },
  });
