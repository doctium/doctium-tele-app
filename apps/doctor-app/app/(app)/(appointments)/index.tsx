import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
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
import { EmptyState } from "../../../src/components/common/EmptyState";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { formatMoney } from "../../../src/utils/money";
import { fetchDoctorAppointments } from "../../../src/store/slices/doctorSlice";

const TABS = ["Upcoming", "Completed", "Cancelled"];
const STATUS: Record<string, string> = {
  Upcoming: "CONFIRMED",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
  amount: number;
  user?: { name: string; image?: string };
  service?: { name: string };
}

export default function DoctorAppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { appointments } = useAppSelector((s) => s.doctor);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [tab, setTab] = useState("Upcoming");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchDoctorAppointments(STATUS[tab]));
  }, [tab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchDoctorAppointments(STATUS[tab]));
    setRefreshing(false);
  }, [dispatch, tab]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Appointments</Text>
        <Text style={styles.subtitle}>Manage your patient consultations</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <AnimatedPressable
              key={t}
              haptic="light"
              onPress={() => setTab(t)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {(appointments as Appointment[]).length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={`No ${tab.toLowerCase()} appointments`}
          description="Your patient appointments will appear here."
        />
      ) : (
        <FlatList
          data={appointments as Appointment[]}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
          renderItem={({ item: a }) => (
            <AnimatedPressable
              haptic="light"
              onPress={() =>
                router.push({
                  pathname: "/(app)/(appointments)/[id]",
                  params: { id: a.id },
                })
              }
              style={styles.card}
            >
              <View style={styles.top}>
                <Avatar name={a.user?.name} uri={a.user?.image} size={50} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.patient} numberOfLines={1}>
                    {a.user?.name ?? "Patient"}
                  </Text>
                  <Text style={styles.service} numberOfLines={1}>
                    {a.service?.name ?? "Consultation"}
                  </Text>
                </View>
                <Badge
                  variant={a.type === "ONLINE" ? "online" : "info"}
                  label={a.type === "ONLINE" ? "Video" : "Clinic"}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.meta}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={colors.teal}
                  />
                  <Text style={styles.metaText}>{a.date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={15} color={colors.teal} />
                  <Text style={styles.metaText}>{a.time}</Text>
                </View>
                <Text style={styles.fee}>{formatMoney(a.amount)}</Text>
              </View>
            </AnimatedPressable>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: Space.xl, marginBottom: 18 },
    title: { ...Type.display, color: c.text.primary },
    subtitle: { ...Type.body, color: c.text.secondary, marginTop: 4 },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: Space.xl,
      gap: 8,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: Radius.md,
      backgroundColor: c.surface,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    tabActive: { backgroundColor: c.navy, borderColor: c.navy },
    tabText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
      letterSpacing: -0.1,
    },
    tabTextActive: { color: "#fff" },
    list: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 120 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    top: { flexDirection: "row", alignItems: "center", gap: 12 },
    patient: { ...Type.title, color: c.text.primary },
    service: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    meta: { flexDirection: "row", alignItems: "center", gap: 16 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { ...Type.caption, color: c.text.secondary },
    fee: {
      marginLeft: "auto",
      fontFamily: Fonts.extrabold,
      fontSize: 16,
      color: c.navy,
      letterSpacing: -0.3,
    },
  });
