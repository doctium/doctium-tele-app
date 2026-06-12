import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  Palette,
  Gradients,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useTheme,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable } from "../../../src/components/ui";
import {
  AuroraField,
  MotionScrollView,
  Reveal,
} from "../../../src/components/motion";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchProfile } from "../../../src/store/slices/userSlice";
import { logout } from "../../../src/store/slices/authSlice";
import { formatMoney } from "../../../src/utils/money";
import { ASSISTANT_NAME } from "../../../src/constants/assistant";

type IoniconName = keyof typeof Ionicons.glyphMap;
interface MenuItem {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { profile } = useAppSelector((s) => s.user);
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // ─── Scroll choreography ───
  const scrollY = useSharedValue(0);
  const [scrolled, setScrolled] = useState(false);

  useAnimatedReaction(
    () => scrollY.value > 110,
    (now, prev) => {
      if (now !== prev) runOnJS(setScrolled)(now);
    },
  );

  // Hero stretches elastically on pull-down (anchored to the top edge).
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-220, 0],
          [-110, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [-220, 0],
          [1.22, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Identity drifts down slower than the scroll and dissolves — depth layer 2.
  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 150], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 220],
          [0, 72],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Frosted compact header condenses in as the hero leaves.
  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [96, 150], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [96, 150],
          [-14, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  useEffect(() => {
    dispatch(fetchProfile());
  }, []);

  const handleLogout = () => {
    Alert.alert(t("profile.signOut"), t("profile.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOut"),
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("accessToken");
          dispatch(logout());
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const sections: { section: string; items: MenuItem[] }[] = [
    {
      section: t("profile.sectionAccount"),
      items: [
        {
          icon: "person-outline",
          label: t("profile.editProfile"),
          onPress: () => router.push("/(app)/(profile)/edit"),
        },
        {
          icon: "heart-outline",
          label: t("profile.favorites"),
          onPress: () => router.push("/(app)/(profile)/favorites"),
        },
        {
          icon: "gift-outline",
          label: t("profile.invite"),
          onPress: () => router.push("/(app)/(profile)/invite"),
        },
        {
          icon: "star-outline",
          label: t("profile.membership"),
          onPress: () => router.push("/(app)/(subscription)"),
        },
        {
          icon: "people-outline",
          label: t("profile.family"),
          onPress: () => router.push("/(app)/(profile)/sub-patients"),
        },
        {
          icon: "folder-open-outline",
          label: t("profile.medicalRecords"),
          onPress: () => router.push("/(app)/(emr)"),
        },
        {
          icon: "pulse-outline",
          label: t("profile.insights"),
          onPress: () => router.push("/(app)/(profile)/insights"),
        },
        {
          icon: "fitness-outline",
          label: t("profile.care"),
          onPress: () => router.push("/(app)/(care)"),
        },
        {
          icon: "heart-circle-outline",
          label: t("profile.careReminders"),
          onPress: () => router.push("/(app)/(profile)/care-reminders"),
        },
        {
          icon: "git-network-outline",
          label: t("profile.referrals"),
          onPress: () => router.push("/(app)/(profile)/referrals"),
        },
        {
          icon: "document-text-outline",
          label: t("profile.prescriptions"),
          onPress: () => router.push("/(app)/(prescriptions)"),
        },
        {
          icon: "wallet-outline",
          label: t("profile.wallet"),
          onPress: () => router.push("/(app)/(wallet)"),
        },
      ],
    },
    {
      section: t("profile.sectionSupport"),
      items: [
        {
          icon: "language-outline",
          label: t("profile.language"),
          onPress: () => router.push("/(app)/(profile)/language"),
        },
        {
          icon: "contrast-outline",
          label: t("profile.appearance", "Appearance"),
          onPress: () => router.push("/(app)/(profile)/appearance"),
        },
        {
          icon: "sparkles-outline",
          label: t("profile.leenah", `${ASSISTANT_NAME} settings`),
          onPress: () => router.push("/(app)/(triage)/settings"),
        },
        {
          icon: "notifications-outline",
          label: t("profile.notifications"),
          onPress: () => router.push("/(app)/(profile)/notifications"),
        },
        {
          icon: "chatbubbles-outline",
          label: t("profile.help"),
          onPress: () => router.push("/(app)/(support)"),
        },
        {
          icon: "happy-outline",
          label: t("profile.rate"),
          onPress: () => router.push("/(app)/(profile)/surveys"),
        },
        {
          icon: "star-outline",
          label: t("profile.reviews"),
          onPress: () => router.push("/(app)/(profile)/reviews"),
        },
      ],
    },
    {
      section: t("profile.sectionAbout"),
      items: [
        {
          icon: "document-text-outline",
          label: t("profile.terms"),
          onPress: () => {},
        },
        {
          icon: "lock-closed-outline",
          label: t("profile.privacy"),
          onPress: () => {},
        },
        {
          icon: "information-circle-outline",
          label: t("profile.about"),
          onPress: () => {},
        },
      ],
    },
    {
      section: "",
      items: [
        {
          icon: "log-out-outline",
          label: t("profile.signOut"),
          onPress: handleLogout,
          destructive: true,
        },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style={scrolled && !isDark ? "dark" : "light"} />
      <MotionScrollView
        scrollY={scrollY}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        <Animated.View style={heroStyle}>
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 20 }]}
          >
            <AuroraField
              scrollY={scrollY}
              blobs={[
                {
                  size: 180,
                  color: "rgba(139,187,233,0.16)",
                  top: -50,
                  right: -40,
                  duration: 10000,
                  driftX: 30,
                  driftY: 22,
                  parallax: 0.22,
                },
                {
                  size: 150,
                  color: "rgba(46,124,194,0.18)",
                  bottom: -60,
                  left: -30,
                  duration: 13500,
                  driftX: 40,
                  driftY: 26,
                  parallax: 0.34,
                },
              ]}
            />
            <Animated.View style={[{ alignItems: "center" }, heroContentStyle]}>
              <Avatar
                uri={profile?.image}
                name={profile?.name}
                size={84}
                ring
              />
              <Text style={styles.name}>
                {profile?.name ?? t("profile.userFallback")}
              </Text>
              <Text style={styles.contact}>
                {profile?.mobile || profile?.email}
              </Text>
              <AnimatedPressable
                haptic="light"
                onPress={() => router.push("/(app)/(wallet)")}
                style={styles.walletChip}
              >
                <Ionicons name="wallet" size={16} color="#fff" />
                <Text style={styles.walletText}>
                  {formatMoney(profile?.wallet?.balance ?? 0)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.text.onDarkDim}
                />
              </AnimatedPressable>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {sections.map((sec, secIdx) => (
          <Reveal
            key={sec.section || "logout"}
            index={Math.min(secIdx, 1)}
            style={styles.section}
          >
            {sec.section ? (
              <Text style={styles.sectionTitle}>{sec.section}</Text>
            ) : null}
            <View style={styles.menuCard}>
              {sec.items.map((item, idx) => (
                <AnimatedPressable
                  key={item.label}
                  haptic="light"
                  onPress={item.onPress}
                  style={[
                    styles.menuItem,
                    idx < sec.items.length - 1 && styles.menuItemBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      item.destructive && { backgroundColor: colors.errorSoft },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={19}
                      color={item.destructive ? colors.error : colors.navyMid}
                    />
                  </View>
                  <Text
                    style={[
                      styles.menuLabel,
                      item.destructive && { color: colors.error },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {!item.destructive ? (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.text.tertiary}
                    />
                  ) : null}
                </AnimatedPressable>
              ))}
            </View>
          </Reveal>
        ))}

        <Reveal>
          <Text style={styles.version}>{t("profile.version")}</Text>
        </Reveal>
      </MotionScrollView>

      {/* ─── Frosted compact header (condenses in on scroll) ─── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.stickyHeader, { paddingTop: insets.top }, stickyStyle]}
      >
        <BlurView
          intensity={55}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.stickyInner}>
          <Text style={styles.stickyName} numberOfLines={1}>
            {profile?.name ?? t("profile.userFallback")}
          </Text>
        </View>
        <View style={styles.stickyHairline} />
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    hero: {
      alignItems: "center",
      paddingBottom: 28,
      paddingHorizontal: Space.xl,
      borderBottomLeftRadius: Radius.xxl,
      borderBottomRightRadius: Radius.xxl,
      overflow: "hidden",
    },
    stickyHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      overflow: "hidden",
    },
    stickyInner: {
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Space.xl,
    },
    stickyName: {
      ...Type.title,
      color: c.text.primary,
      fontFamily: Fonts.extrabold,
    },
    stickyHairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.hairline,
    },
    name: { ...Type.h1, color: "#fff", marginTop: 14 },
    contact: { ...Type.body, color: c.text.onDark, marginTop: 4 },
    walletChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: Radius.round,
    },
    walletText: { fontFamily: Fonts.bold, fontSize: 15, color: "#fff" },
    section: { paddingHorizontal: Space.xl, marginTop: 22 },
    sectionTitle: {
      ...Type.overline,
      color: c.text.tertiary,
      marginBottom: 10,
      marginLeft: 4,
    },
    menuCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 14,
    },
    menuItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    menuLabel: { flex: 1, ...Type.bodyMed, color: c.text.primary },
    version: {
      textAlign: "center",
      ...Type.caption,
      color: c.text.tertiary,
      paddingVertical: 28,
    },
  });
