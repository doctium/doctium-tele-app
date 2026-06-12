import React, { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
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

const FAQS = [
  {
    q: "How do I set my availability?",
    a: "Go to Schedule, toggle the days you work, and set your working hours, slot length, and break times, then tap Save.",
  },
  {
    q: "How do appointment payments work?",
    a: "Patients pay when booking. Your share is credited to your wallet once the consultation is completed.",
  },
  {
    q: "How do I withdraw my earnings?",
    a: "Open Earnings & wallet and tap “Request withdrawal”. Requests are reviewed and processed by Doctium admin.",
  },
  {
    q: "How do I start a video consultation?",
    a: "Open the confirmed appointment and tap “Start video call”, or start a call from a patient chat.",
  },
  {
    q: "Can I share health videos with patients?",
    a: "Yes — go to My videos and upload educational clips that appear in the patient app’s MediGram feed.",
  },
];

const makeContacts = (
  c: Palette,
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
    label: "Email",
    sub: "providers@doctium.com",
    url: "mailto:providers@doctium.com",
    color: c.skyDeep,
    bg: c.skySoft,
  },
  {
    icon: "call",
    label: "Call",
    sub: "+234 800 000 0000",
    url: "tel:+2348000000000",
    color: c.tealDeep,
    bg: c.tealSoft,
  },
  {
    icon: "logo-whatsapp",
    label: "WhatsApp",
    sub: "Provider support",
    url: "https://wa.me/2348000000000",
    color: "#1FA855",
    bg: "#E7F8EE",
  },
];

export default function HelpScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const CONTACTS = makeContacts(colors);
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={styles.root}>
      <AppHeader title="Help & support" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Txt variant="h1" style={{ marginBottom: 6 }}>
          How can we help?
        </Txt>
        <Txt
          variant="body"
          color={colors.text.secondary}
          style={{ marginBottom: 20 }}
        >
          Common questions and ways to reach provider support.
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

        <Text style={styles.sectionTitle}>Frequently asked</Text>
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
