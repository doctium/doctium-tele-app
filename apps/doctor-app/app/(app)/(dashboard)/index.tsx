import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Gradients,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { AnimatedPressable } from "../../../src/components/ui";
import { Avatar } from "../../../src/components/common/Avatar";
import { Badge } from "../../../src/components/common/Badge";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { formatMoney, toMajorUnits } from "../../../src/utils/money";
import {
  fetchDoctorProfile,
  fetchDoctorAppointments,
} from "../../../src/store/slices/doctorSlice";

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
  user?: { name: string; image?: string };
  service?: { name: string };
}

type IoniconName = keyof typeof Ionicons.glyphMap;
const QUICK: { icon: IoniconName; label: string; path: string }[] = [
  { icon: "calendar", label: "Appointments", path: "/(app)/(appointments)" },
  { icon: "time", label: "Schedule", path: "/(app)/(schedule)" },
  { icon: "play-circle", label: "My videos", path: "/(app)/(videos)" },
  { icon: "chatbubble-ellipses", label: "Messages", path: "/(app)/(chat)" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { profile, appointments } = useAppSelector((s) => s.doctor);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    dispatch(fetchDoctorProfile());
    dispatch(fetchDoctorAppointments("CONFIRMED"));
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 800);
  }, [load]);

  const upcoming = (appointments as Appointment[]).slice(0, 5);
  const todayStr = new Date().toISOString().split("T")[0];
  const todayAppts = (appointments as Appointment[]).filter(
    (a) => a.date === todayStr,
  );
  const firstName = profile?.name?.split(" ")[0] ?? "";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
            colors={[colors.teal]}
            progressViewOffset={60}
          />
        }
      >
        {/* Earnings hero */}
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.blobA} />
          <View style={styles.blobB} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting()},</Text>
              <Text style={styles.name} numberOfLines={1}>
                Dr. {firstName}
              </Text>
            </View>
            <AnimatedPressable
              haptic="light"
              onPress={() => router.push("/(app)/(profile)")}
            >
              <Avatar
                uri={profile?.image}
                name={profile?.name}
                size={48}
                ring
              />
            </AnimatedPressable>
          </View>

          <Text style={styles.walletLabel}>Wallet balance</Text>
          <Text style={styles.balance}>
            {formatMoney(profile?.wallet?.balance ?? 0)}
          </Text>

          <View style={styles.stats}>
            <Stat
              value={`₦${shortMoney(profile?.wallet?.total ?? 0)}`}
              label="Total earned"
            />
            <View style={styles.statDivider} />
            <Stat value={`${todayAppts.length}`} label="Today" />
            <View style={styles.statDivider} />
            <Stat
              value={profile?.rating?.toFixed(1) ?? "–"}
              label="Rating"
              icon
            />
          </View>

          <AnimatedPressable
            haptic="medium"
            onPress={() => router.push("/(app)/(earnings)")}
            style={styles.withdrawBtn}
          >
            <Ionicons name="wallet-outline" size={17} color={colors.navy} />
            <Text style={styles.withdrawText}>Withdraw earnings</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.navy} />
          </AnimatedPressable>
        </LinearGradient>

        {/* Verification nudge (hidden once VERIFIED) */}
        {(() => {
          const v = (profile as { verificationStatus?: string } | null)
            ?.verificationStatus;
          if (!v || v === "VERIFIED") return null;
          const msg: Record<string, string> = {
            NEW: "Your registration is under review.",
            PENDING_KYC: "Complete your verification to start seeing patients.",
            UNDER_REVIEW: "Your documents are under review.",
            REJECTED: "Verification needs attention — tap to fix.",
            EXPIRED: "Your licence expired — re-upload to restore your badge.",
          };
          const warn = v === "REJECTED" || v === "EXPIRED";
          return (
            <AnimatedPressable
              haptic="light"
              onPress={() => router.push("/(app)/(verification)")}
              style={[
                styles.verifyBanner,
                { backgroundColor: warn ? colors.errorSoft : colors.tealSoft },
              ]}
            >
              <Ionicons
                name={warn ? "alert-circle" : "shield-checkmark-outline"}
                size={20}
                color={warn ? colors.error : colors.tealDeep}
              />
              <Text
                style={[
                  styles.verifyText,
                  { color: warn ? colors.error : colors.tealDeep },
                ]}
              >
                {msg[v] ?? "Complete your verification."}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={warn ? colors.error : colors.tealDeep}
              />
            </AnimatedPressable>
          );
        })()}

        {/* Quick actions */}
        <Animated.View
          entering={FadeInDown.delay(80).springify().damping(18)}
          style={styles.quickRow}
        >
          {QUICK.map((q) => (
            <AnimatedPressable
              key={q.label}
              haptic="light"
              onPress={() => router.push(q.path as never)}
              style={styles.quick}
            >
              <LinearGradient
                colors={Gradients.aurora}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickIcon}
              >
                <Ionicons name={q.icon} size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickLabel} numberOfLines={1}>
                {q.label}
              </Text>
            </AnimatedPressable>
          ))}
        </Animated.View>

        {/* Upcoming */}
        <Animated.View
          entering={FadeInDown.delay(160).springify().damping(18)}
          style={styles.section}
        >
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Upcoming patients</Text>
            <AnimatedPressable
              haptic={false}
              onPress={() => router.push("/(app)/(appointments)")}
            >
              <Text style={styles.seeAll}>See all</Text>
            </AnimatedPressable>
          </View>
          {upcoming.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="calendar-clear-outline"
                size={20}
                color={colors.text.tertiary}
              />
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            </View>
          ) : (
            upcoming.map((a) => (
              <AnimatedPressable
                key={a.id}
                haptic="light"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(appointments)/[id]",
                    params: { id: a.id },
                  })
                }
                style={styles.apptCard}
              >
                <Avatar name={a.user?.name} uri={a.user?.image} size={50} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.apptPatient} numberOfLines={1}>
                    {a.user?.name ?? "Patient"}
                  </Text>
                  <Text style={styles.apptService} numberOfLines={1}>
                    {a.service?.name ?? "Consultation"}
                  </Text>
                  <View style={styles.apptMeta}>
                    <Ionicons
                      name="time-outline"
                      size={13}
                      color={colors.teal}
                    />
                    <Text style={styles.apptTime}>
                      {a.date} · {a.time}
                    </Text>
                  </View>
                </View>
                <Badge
                  variant={a.type === "ONLINE" ? "online" : "info"}
                  label={a.type === "ONLINE" ? "Video" : "Clinic"}
                />
              </AnimatedPressable>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Stat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        {icon ? <Ionicons name="star" size={13} color="#FBBF24" /> : null}
        <Text style={styles.statVal}>{value}</Text>
      </View>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

// Abbreviated money ("1.2M"/"5k"). Routes through toMajorUnits so it stays
// correct after the kobo migration (the ₦ prefix is added at the call site).
function shortMoney(stored: number) {
  const n = toMajorUnits(stored);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    hero: {
      paddingHorizontal: Space.xl,
      paddingBottom: 26,
      borderBottomLeftRadius: Radius.xxl,
      borderBottomRightRadius: Radius.xxl,
      overflow: "hidden",
    },
    blobA: {
      position: "absolute",
      top: -50,
      right: -30,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(139,187,233,0.16)",
    },
    blobB: {
      position: "absolute",
      bottom: -70,
      left: -40,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: "rgba(139,187,233,0.16)",
    },
    heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
    greeting: { ...Type.bodySm, color: c.text.onDarkDim },
    name: { ...Type.h1, color: "#fff", marginTop: 2 },
    walletLabel: {
      ...Type.label,
      color: c.text.onDarkDim,
      letterSpacing: 0.4,
    },
    balance: {
      fontFamily: Fonts.extrabold,
      fontSize: 40,
      color: "#fff",
      letterSpacing: -1.2,
      marginTop: 6,
    },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 20,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: Radius.lg,
      paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.16)",
    },
    stat: { flex: 1, alignItems: "center" },
    statVal: {
      fontFamily: Fonts.extrabold,
      fontSize: 17,
      color: "#fff",
      letterSpacing: -0.3,
    },
    statLbl: { ...Type.caption, color: c.text.onDarkDim, marginTop: 3 },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 30,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    withdrawBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#fff",
      borderRadius: Radius.md,
      paddingVertical: 14,
      marginTop: 18,
    },
    withdrawText: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: c.navy,
      letterSpacing: -0.2,
    },
    verifyBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: Space.xl,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: Radius.lg,
    },
    verifyText: { flex: 1, ...Type.bodySm, fontFamily: Fonts.semibold },
    quickRow: {
      flexDirection: "row",
      paddingHorizontal: Space.xl,
      gap: 12,
      marginTop: 22,
    },
    quick: { flex: 1, alignItems: "center", gap: 8 },
    quickIcon: {
      width: 56,
      height: 56,
      borderRadius: Radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.card,
    },
    quickLabel: {
      ...Type.caption,
      color: c.text.secondary,
      textAlign: "center",
    },
    section: { paddingHorizontal: Space.xl, marginTop: 28 },
    sectionHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: { ...Type.h2, color: c.text.primary },
    seeAll: { ...Type.label, color: c.teal },
    empty: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.lg,
      paddingVertical: 22,
    },
    emptyText: { ...Type.bodySm, color: c.text.tertiary },
    apptCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    apptPatient: { ...Type.h3, color: c.text.primary },
    apptService: {
      ...Type.caption,
      color: c.text.secondary,
      marginTop: 2,
    },
    apptMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
    },
    apptTime: { ...Type.caption, color: c.text.secondary },
  });
