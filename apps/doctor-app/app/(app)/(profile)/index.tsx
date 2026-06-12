import React, { useEffect } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView } from "react-native";
import {
  Gradients,
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { StarRating } from "../../../src/components/common/StarRating";
import { formatMoney } from "../../../src/utils/money";
import { AnimatedPressable } from "../../../src/components/ui";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchDoctorProfile } from "../../../src/store/slices/doctorSlice";
import { logout } from "../../../src/store/slices/authSlice";

type IoniconName = keyof typeof Ionicons.glyphMap;
interface MenuItem {
  icon: IoniconName;
  label: string;
  path: string | null;
  destructive?: boolean;
}

export default function DoctorProfileScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { profile } = useAppSelector((s) => s.doctor);

  useEffect(() => {
    dispatch(fetchDoctorProfile());
  }, []);

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("doctorAccessToken");
          dispatch(logout());
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Practice",
      items: [
        {
          icon: "create-outline",
          label: "Edit profile & banner",
          path: "/(app)/(profile)/edit",
        },
        {
          icon: "shield-checkmark-outline",
          label: "Verification & licences",
          path: "/(app)/(verification)",
        },
        {
          icon: "ribbon-outline",
          label: "DoctiumPlus for Doctors",
          path: "/(app)/(subscription)",
        },
        {
          icon: "cash-outline",
          label: "Consultation fees",
          path: "/(app)/(profile)/pricing",
        },
        {
          icon: "earth-outline",
          label: "Practice & region",
          path: "/(app)/(profile)/region",
        },
        {
          icon: "time-outline",
          label: "My schedule",
          path: "/(app)/(schedule)",
        },
        {
          icon: "wallet-outline",
          label: "Earnings & wallet",
          path: "/(app)/(earnings)",
        },
        {
          icon: "play-circle-outline",
          label: "My videos",
          path: "/(app)/(videos)",
        },
        {
          icon: "create-outline",
          label: "Prescription signature",
          path: "/(app)/(profile)/signature",
        },
        {
          icon: "repeat-outline",
          label: "Refill requests",
          path: "/(app)/(prescriptions)/refill-requests",
        },
        {
          icon: "git-network-outline",
          label: "Referrals",
          path: "/(app)/(referrals)",
        },
        {
          icon: "happy-outline",
          label: "Patient feedback",
          path: "/(app)/(profile)/feedback",
        },
        {
          icon: "fitness-outline",
          label: "Care programs",
          path: "/(app)/(care)",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: "contrast-outline",
          label: "Appearance",
          path: "/(app)/(profile)/appearance",
        },
        {
          icon: "help-buoy-outline",
          label: "Help & support",
          path: "/(app)/(profile)/help",
        },
      ],
    },
    {
      title: "",
      items: [
        {
          icon: "log-out-outline",
          label: "Sign out",
          path: null,
          destructive: true,
        },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.blob} />
          <Avatar uri={profile?.image} name={profile?.name} size={84} ring />
          <Text style={styles.name}>{profile?.name ?? "Doctor"}</Text>
          <Text style={styles.spec}>{profile?.designation}</Text>
          <View style={{ marginTop: 8 }}>
            <StarRatingDark
              rating={profile?.rating ?? 0}
              count={profile?.reviewCount ?? 0}
            />
          </View>

          <View style={styles.stats}>
            <Stat value={`${profile?.experience ?? 0} yr`} label="Experience" />
            <View style={styles.statDivider} />
            <Stat value={`${profile?.reviewCount ?? 0}`} label="Patients" />
            <View style={styles.statDivider} />
            <Stat value={formatMoney(profile?.charge ?? 0)} label="Per visit" />
          </View>
        </LinearGradient>

        {sections.map((sec) => (
          <View key={sec.title || "logout"} style={styles.section}>
            {sec.title ? (
              <Text style={styles.sectionTitle}>{sec.title}</Text>
            ) : null}
            <View style={styles.menuCard}>
              {sec.items.map((item, idx) => (
                <AnimatedPressable
                  key={item.label}
                  haptic="light"
                  onPress={() =>
                    item.destructive
                      ? handleLogout()
                      : router.push(item.path as never)
                  }
                  style={[
                    styles.menuItem,
                    idx < sec.items.length - 1 && styles.menuBorder,
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
          </View>
        ))}

        <Text style={styles.version}>Doctium for doctors · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function StarRatingDark({ rating, count }: { rating: number; count: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={14} color="#FBBF24" />
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      <Text style={styles.ratingCount}>({count})</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    hero: {
      alignItems: "center",
      paddingBottom: 26,
      paddingHorizontal: Space.xl,
      borderBottomLeftRadius: Radius.xxl,
      borderBottomRightRadius: Radius.xxl,
      overflow: "hidden",
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
    name: { ...Type.h1, color: "#fff", marginTop: 14 },
    spec: { ...Type.body, color: c.text.onDark, marginTop: 4 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontFamily: Fonts.bold, fontSize: 14, color: "#fff" },
    ratingCount: { ...Type.caption, color: c.text.onDarkDim },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 20,
      alignSelf: "stretch",
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: Radius.lg,
      paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.16)",
    },
    stat: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
    statVal: {
      fontFamily: Fonts.extrabold,
      fontSize: 16,
      color: "#fff",
      letterSpacing: -0.3,
    },
    statLbl: { ...Type.caption, color: c.text.onDarkDim, marginTop: 3 },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 30,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
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
    menuBorder: {
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
