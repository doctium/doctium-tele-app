import React, { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";

const makeFaqs = (t: (k: string) => string) => [
  { q: t("help.faqBookQ"), a: t("help.faqBookA") },
  { q: t("help.faqPrivateQ"), a: t("help.faqPrivateA") },
  { q: t("help.faqVideoQ"), a: t("help.faqVideoA") },
  { q: t("help.faqRxQ"), a: t("help.faqRxA") },
  { q: t("help.faqCancelQ"), a: t("help.faqCancelA") },
];

const makeContacts = (
  c: Palette,
  t: (k: string) => string,
): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  url: string;
  color: string;
  bg: string;
}[] => [
  {
    icon: "mail",
    label: t("help.emailUs"),
    sub: "support@doctium.com",
    url: "mailto:support@doctium.com",
    color: c.skyDeep,
    bg: c.skySoft,
  },
  {
    icon: "call",
    label: t("help.callUs"),
    sub: "+234 800 000 0000",
    url: "tel:+2348000000000",
    color: c.tealDeep,
    bg: c.tealSoft,
  },
  {
    icon: "logo-whatsapp",
    label: t("help.whatsapp"),
    sub: t("help.chatWithSupport"),
    url: "https://wa.me/2348000000000",
    color: "#1FA855",
    bg: "#E7F8EE",
  },
];

export default function HelpScreen() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(0);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const CONTACTS = makeContacts(colors, t);
  const FAQS = makeFaqs(t);

  return (
    <View style={styles.root}>
      <AppHeader title={t("help.title")} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Txt variant="h1" style={{ marginBottom: 6 }}>
          {t("help.heading")}
        </Txt>
        <Txt
          variant="body"
          color={colors.text.secondary}
          style={{ marginBottom: 20 }}
        >
          {t("help.subheading")}
        </Txt>

        <View style={styles.contactRow}>
          {CONTACTS.map((c) => (
            <AnimatedPressable
              key={c.label}
              haptic="light"
              onPress={() => Linking.openURL(c.url).catch(() => {})}
              style={styles.contactCard}
            >
              <View style={[styles.contactIcon, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={22} color={c.color} />
              </View>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactSub} numberOfLines={1}>
                {c.sub}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("help.faqTitle")}</Text>
        {FAQS.map((f, i) => {
          const expanded = open === i;
          return (
            <AnimatedPressable
              key={i}
              haptic="light"
              onPress={() => setOpen(expanded ? null : i)}
              style={styles.faq}
            >
              <View style={styles.faqRow}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons
                  name={expanded ? "remove" : "add"}
                  size={20}
                  color={colors.teal}
                />
              </View>
              {expanded ? (
                <Animated.Text
                  entering={FadeIn.duration(180)}
                  style={styles.faqA}
                >
                  {f.a}
                </Animated.Text>
              ) : null}
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    contactRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
    contactCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    contactIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    contactLabel: { ...Type.label, color: c.text.primary },
    contactSub: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },
    sectionTitle: { ...Type.h2, color: c.text.primary, marginBottom: 12 },
    faq: {
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 16,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    faqRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    faqQ: { flex: 1, ...Type.title, color: c.text.primary },
    faqA: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginTop: 10,
      lineHeight: 20,
    },
  });
