import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Palette,
  Fonts,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { Button } from "../../../src/components/common/Button";
import { AppHeader, AnimatedPressable, Card } from "../../../src/components/ui";
import { followupsApi } from "../../../src/api/followups.api";

type FollowUpType =
  | "CHECK_IN_48H"
  | "CHECK_IN_7D"
  | "DOCTOR_SCHEDULED"
  | "MISSED_RECOVERY";

interface FollowUp {
  id: string;
  type: FollowUpType;
  status: "PENDING" | "SENT" | "CANCELLED";
  scheduledFor: string;
  title: string;
  message: string;
  doctorNote?: string;
  doctorId?: string;
  doctor?: { name: string; image?: string; designation?: string };
}

const makeMeta = (
  c: Palette,
): Record<
  FollowUpType,
  {
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    bg: string;
    label: string;
  }
> => ({
  CHECK_IN_48H: {
    icon: "heart-outline",
    tint: c.teal,
    bg: c.tealSoft,
    label: "Wellbeing check-in",
  },
  CHECK_IN_7D: {
    icon: "heart-outline",
    tint: c.teal,
    bg: c.tealSoft,
    label: "Wellbeing check-in",
  },
  DOCTOR_SCHEDULED: {
    icon: "calendar",
    tint: c.navy,
    bg: "rgba(19,49,87,0.08)",
    label: "Doctor follow-up",
  },
  MISSED_RECOVERY: {
    icon: "alert-circle",
    tint: "#B54708",
    bg: "rgba(247,144,9,0.12)",
    label: "Missed appointment",
  },
});

function whenLabel(iso: string, past: boolean): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(Math.abs(diff) / 86400000);
  const hrs = Math.round(Math.abs(diff) / 3600000);
  if (past) {
    if (hrs < 24) return hrs <= 1 ? "just now" : `${hrs}h ago`;
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
  if (hrs < 24) return hrs <= 1 ? "soon" : `in ${hrs}h`;
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export default function CareRemindersScreen() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const load = useCallback(() => {
    followupsApi
      .getMine()
      .then((r: unknown) => setItems((r as { data: FollowUp[] }).data ?? []))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async (id: string) => {
    setItems((list) => list.filter((f) => f.id !== id));
    try {
      await followupsApi.cancel(id);
    } catch {
      load();
    }
  };

  const book = (f: FollowUp) => {
    if (f.doctorId) {
      router.push({
        pathname: "/(app)/(doctors)/[id]",
        params: { id: f.doctorId },
      });
    } else {
      router.push("/(app)/(doctors)/search");
    }
  };

  const visible = items.filter((f) => f.status !== "CANCELLED");
  const upcoming = visible.filter((f) => f.status === "PENDING");
  const past = visible.filter((f) => f.status === "SENT");

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title="Care reminders" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.teal}
          />
        }
      >
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="heart-circle-outline"
                size={42}
                color={colors.teal}
              />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyText}>
              Check-ins and follow-up reminders from your doctors will appear
              here after a consultation.
            </Text>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={styles.section}>Upcoming</Text>
                {upcoming.map((f) => (
                  <FollowUpCard
                    key={f.id}
                    f={f}
                    onBook={() => book(f)}
                    onDismiss={() => dismiss(f.id)}
                  />
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text
                  style={[
                    styles.section,
                    { marginTop: upcoming.length ? 18 : 0 },
                  ]}
                >
                  Earlier
                </Text>
                {past.map((f) => (
                  <FollowUpCard key={f.id} f={f} onBook={() => book(f)} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FollowUpCard({
  f,
  onBook,
  onDismiss,
}: {
  f: FollowUp;
  onBook: () => void;
  onDismiss?: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const m = makeMeta(colors)[f.type];
  const pending = f.status === "PENDING";
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.typeIcon, { backgroundColor: m.bg }]}>
          <Ionicons name={m.icon} size={18} color={m.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeLabel}>{m.label}</Text>
          <Text style={styles.when}>{whenLabel(f.scheduledFor, !pending)}</Text>
        </View>
      </View>

      <Text style={styles.title}>{f.title}</Text>
      <Text style={styles.message}>{f.message}</Text>

      {f.doctor ? (
        <View style={styles.docRow}>
          <Avatar uri={f.doctor.image} name={f.doctor.name} size={26} />
          <Text style={styles.docName}>Dr. {f.doctor.name}</Text>
          {f.doctor.designation ? (
            <Text style={styles.docSpec}>· {f.doctor.designation}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Book appointment"
          onPress={onBook}
          style={{ flex: 1 }}
          icon={<Ionicons name="calendar-outline" size={17} color="#fff" />}
        />
        {pending && onDismiss ? (
          <AnimatedPressable
            haptic="light"
            onPress={onDismiss}
            style={styles.dismiss}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </AnimatedPressable>
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    section: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      color: c.text.tertiary,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    card: { marginBottom: 14 },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginBottom: 12,
    },
    typeIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    typeLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
    },
    when: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    title: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: c.text.primary,
      letterSpacing: -0.2,
      marginBottom: 4,
    },
    message: { ...Type.bodySm, color: c.text.secondary, lineHeight: 19 },
    docRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
    },
    docName: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.primary,
    },
    docSpec: { ...Type.caption, color: c.text.tertiary },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    },
    dismiss: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    dismissText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: c.text.secondary,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      paddingHorizontal: 30,
      gap: 12,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.tealSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontFamily: Fonts.bold,
      fontSize: 18,
      color: c.text.primary,
    },
    emptyText: {
      ...Type.body,
      color: c.text.tertiary,
      textAlign: "center",
      lineHeight: 21,
    },
  });
