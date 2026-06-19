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
import { useTranslation } from "react-i18next";
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
  t: (k: string) => string,
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
    label: t("careReminders.typeWellbeing"),
  },
  CHECK_IN_7D: {
    icon: "heart-outline",
    tint: c.teal,
    bg: c.tealSoft,
    label: t("careReminders.typeWellbeing"),
  },
  DOCTOR_SCHEDULED: {
    icon: "calendar",
    tint: c.navy,
    bg: "rgba(19,49,87,0.08)",
    label: t("careReminders.typeDoctorFollowUp"),
  },
  MISSED_RECOVERY: {
    icon: "alert-circle",
    tint: "#B54708",
    bg: "rgba(247,144,9,0.12)",
    label: t("careReminders.typeMissed"),
  },
});

function whenLabel(
  iso: string,
  past: boolean,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(Math.abs(diff) / 86400000);
  const hrs = Math.round(Math.abs(diff) / 3600000);
  if (past) {
    if (hrs < 24)
      return hrs <= 1
        ? t("careReminders.justNow")
        : t("careReminders.hoursAgo", { count: hrs });
    return days === 1
      ? t("careReminders.yesterday")
      : t("careReminders.daysAgo", { count: days });
  }
  if (hrs < 24)
    return hrs <= 1
      ? t("careReminders.soon")
      : t("careReminders.inHours", { count: hrs });
  return days === 1
    ? t("careReminders.tomorrow")
    : t("careReminders.inDays", { count: days });
}

export default function CareRemindersScreen() {
  const { t } = useTranslation();
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
      <AppHeader title={t("careReminders.title")} />
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
            <Text style={styles.emptyTitle}>
              {t("careReminders.emptyTitle")}
            </Text>
            <Text style={styles.emptyText}>{t("careReminders.emptyDesc")}</Text>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={styles.section}>
                  {t("careReminders.upcoming")}
                </Text>
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
                  {t("careReminders.earlier")}
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
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const m = makeMeta(colors, t)[f.type];
  const pending = f.status === "PENDING";
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.typeIcon, { backgroundColor: m.bg }]}>
          <Ionicons name={m.icon} size={18} color={m.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeLabel}>{m.label}</Text>
          <Text style={styles.when}>
            {whenLabel(f.scheduledFor, !pending, t)}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{f.title}</Text>
      <Text style={styles.message}>{f.message}</Text>

      {f.doctor ? (
        <View style={styles.docRow}>
          <Avatar uri={f.doctor.image} name={f.doctor.name} size={26} />
          <Text style={styles.docName}>
            {t("careReminders.doctorName", { name: f.doctor.name })}
          </Text>
          {f.doctor.designation ? (
            <Text style={styles.docSpec}>· {f.doctor.designation}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={t("careReminders.bookAppointment")}
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
            <Text style={styles.dismissText}>{t("careReminders.dismiss")}</Text>
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
