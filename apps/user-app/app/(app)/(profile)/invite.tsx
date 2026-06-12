import React, { useEffect } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  Palette,
  Gradients,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchProfile } from "../../../src/store/slices/userSlice";
import { formatMoney } from "../../../src/utils/money";

interface ReferralInfo {
  referred: number;
  rewarded: number;
  bonusKobo: number;
}

export default function InviteFriendsScreen() {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((s) => s.user);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const code =
    (profile as { referralCode?: string } | null)?.referralCode ?? "";
  const referral =
    ((profile as { referral?: ReferralInfo } | null)
      ?.referral as ReferralInfo) ??
    ({ referred: 0, rewarded: 0, bonusKobo: 0 } as ReferralInfo);

  useEffect(() => {
    dispatch(fetchProfile());
  }, []);

  const shareLink = `https://doctium.com/register?ref=${code}`;
  const share = () => {
    if (!code) return;
    Share.share({
      message: `Join me on Doctium — quality doctors, right from your phone! Sign up with my referral code ${code} and book your first consultation. ${shareLink}`,
    }).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Invite friends" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {/* ── Hero with the code ── */}
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.blob} />
          <View style={styles.giftIcon}>
            <Ionicons name="gift" size={26} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>
            {referral.bonusKobo > 0
              ? `Earn ${formatMoney(referral.bonusKobo)} per friend`
              : "Share Doctium with friends"}
          </Text>
          <Text style={styles.heroSub}>
            {referral.bonusKobo > 0
              ? "You get paid when a friend signs up with your code and books their first consultation."
              : "Friends who sign up with your code help our community grow."}
          </Text>

          <Text style={styles.codeLabel}>Your referral code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{code || "…"}</Text>
          </View>

          <AnimatedPressable
            haptic="medium"
            onPress={share}
            style={styles.shareBtn}
          >
            <Ionicons name="share-social" size={17} color={colors.navy} />
            <Text style={styles.shareText}>Share my link</Text>
          </AnimatedPressable>
        </LinearGradient>

        {/* ── Stats ── */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{referral.referred}</Text>
            <Text style={styles.statLabel}>Friends joined</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{referral.rewarded}</Text>
            <Text style={styles.statLabel}>Bonuses earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.teal }]}>
              {formatMoney(referral.rewarded * referral.bonusKobo)}
            </Text>
            <Text style={styles.statLabel}>Total earned</Text>
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            {
              icon: "share-social-outline" as const,
              text: "Share your code or link with friends and family.",
            },
            {
              icon: "person-add-outline" as const,
              text: "They sign up with your code on the registration page.",
            },
            {
              icon: "wallet-outline" as const,
              text:
                referral.bonusKobo > 0
                  ? `When they book and pay for their first consultation, ${formatMoney(referral.bonusKobo)} lands in your wallet.`
                  : "When they book and pay for their first consultation, your bonus lands in your wallet.",
            },
          ].map((s, i) => (
            <View key={i} style={styles.howRow}>
              <View style={styles.howIcon}>
                <Ionicons name={s.icon} size={17} color={colors.teal} />
              </View>
              <Text style={styles.howText}>{s.text}</Text>
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
    list: { paddingHorizontal: Space.xl, paddingBottom: 40 },

    hero: {
      borderRadius: Radius.xxl,
      padding: 24,
      alignItems: "center",
      overflow: "hidden",
      ...Shadow.raised,
    },
    blob: {
      position: "absolute",
      top: -50,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(139,187,233,0.16)",
    },
    giftIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      fontFamily: Fonts.extrabold,
      fontSize: 22,
      color: "#fff",
      letterSpacing: -0.4,
      marginTop: 14,
      textAlign: "center",
    },
    heroSub: {
      ...Type.bodySm,
      color: c.text.onDarkDim,
      textAlign: "center",
      marginTop: 6,
      paddingHorizontal: 8,
    },
    codeLabel: {
      ...Type.label,
      color: c.text.onDarkDim,
      marginTop: 20,
      letterSpacing: 0.5,
    },
    codeBox: {
      backgroundColor: "rgba(255,255,255,0.10)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      borderStyle: "dashed",
      borderRadius: Radius.lg,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 8,
    },
    codeText: {
      fontFamily: Fonts.extrabold,
      fontSize: 24,
      color: "#fff",
      letterSpacing: 4,
    },
    shareBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#fff",
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: Radius.round,
      marginTop: 18,
    },
    shareText: { fontFamily: Fonts.bold, fontSize: 14.5, color: c.navy },

    statRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 14,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    statValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 17,
      color: c.text.primary,
      letterSpacing: -0.3,
    },
    statLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },

    howCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 18,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    howTitle: { ...Type.h3, color: c.text.primary, marginBottom: 12 },
    howRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    howIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    howText: {
      ...Type.bodySm,
      color: c.text.secondary,
      flex: 1,
      lineHeight: 19,
    },
  });
