import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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
import { Avatar } from "../../../src/components/common/Avatar";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface VitalMeta {
  label: string;
  unit: string;
  hasSecond: boolean;
}
interface CohortMember {
  id: string;
  rag: "RED" | "AMBER" | "GREEN";
  program: { name: string; condition: string };
  user: { id: string; name: string; image: string };
  subPatient: { id: string; name: string } | null;
  latestByType: Record<
    string,
    { value: number; value2: number | null; takenAt: string }
  >;
  openAlerts: number;
  readings7d: number;
  risk?: { score: number; level: string } | null;
  adherence: {
    expectedPerWeek: number;
    readings7d: number;
    percent: number | null;
  } | null;
}
interface AlertRow {
  id: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
  enrollment: {
    id: string;
    program: { name: string };
    user: { name: string; image: string };
  };
}

const ragColor = (c: Palette) => ({
  RED: c.error,
  AMBER: c.warning,
  GREEN: c.success,
});

export default function CareCohortScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const RAG_COLOR = ragColor(colors);
  const [cohort, setCohort] = useState<CohortMember[]>([]);
  const [vitalCatalog, setVitalCatalog] = useState<Record<string, VitalMeta>>(
    {},
  );
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([doctorApi.getCareCohort(), doctorApi.getCareAlerts()])
      .then(([c, a]: unknown[]) => {
        const cd = (
          c as {
            data: {
              cohort: CohortMember[];
              vitalCatalog: Record<string, VitalMeta>;
            };
          }
        ).data;
        setCohort(cd.cohort ?? []);
        setVitalCatalog(cd.vitalCatalog ?? {});
        setAlerts((a as { data: AlertRow[] }).data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const ack = async (id: string) => {
    setAcking(id);
    try {
      await doctorApi.ackCareAlert(id);
      load();
    } catch {
    } finally {
      setAcking(null);
    }
  };

  const fmt = (type: string, v: { value: number; value2: number | null }) => {
    const meta = vitalCatalog[type];
    const val =
      meta?.hasSecond && v.value2 != null
        ? `${v.value}/${v.value2}`
        : `${v.value}`;
    return `${val} ${meta?.unit ?? ""}`.trim();
  };

  const counts = {
    red: cohort.filter((c) => c.rag === "RED").length,
    amber: cohort.filter((c) => c.rag === "AMBER").length,
    green: cohort.filter((c) => c.rag === "GREEN").length,
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Care programs" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {/* ── RAG summary ── */}
          <View style={styles.ragRow}>
            {(
              [
                {
                  key: "red",
                  label: "Needs action",
                  color: colors.error,
                  n: counts.red,
                },
                {
                  key: "amber",
                  label: "Watch",
                  color: colors.warning,
                  n: counts.amber,
                },
                {
                  key: "green",
                  label: "Stable",
                  color: colors.success,
                  n: counts.green,
                },
              ] as const
            ).map((s) => (
              <View key={s.key} style={styles.ragCard}>
                <View style={[styles.ragDot, { backgroundColor: s.color }]} />
                <Text style={styles.ragCount}>{s.n}</Text>
                <Text style={styles.ragLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Alert inbox ── */}
          {alerts.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>
                Open alerts ({alerts.length})
              </Text>
              {alerts.map((a) => (
                <View key={a.id} style={styles.alertCard}>
                  <View
                    style={[
                      styles.sevStripe,
                      {
                        backgroundColor:
                          a.severity === "CRITICAL"
                            ? colors.error
                            : colors.warning,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertMsg}>{a.message}</Text>
                    <Text style={styles.alertMeta}>
                      {a.severity === "CRITICAL" ? "Critical" : "Warning"} ·{" "}
                      {new Date(a.createdAt).toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <AnimatedPressable
                    haptic="medium"
                    onPress={() => ack(a.id)}
                    style={styles.ackBtn}
                  >
                    {acking === a.id ? (
                      <ActivityIndicator size="small" color={colors.navy} />
                    ) : (
                      <Text style={styles.ackText}>Acknowledge</Text>
                    )}
                  </AnimatedPressable>
                </View>
              ))}
            </>
          ) : null}

          {/* ── Cohort ── */}
          <Text style={styles.sectionTitle}>My patients ({cohort.length})</Text>
          {cohort.length === 0 ? (
            <View style={{ marginTop: 10 }}>
              <EmptyState
                icon="fitness-outline"
                title="No enrolled patients yet"
                description="When patients join a care program with you as care lead, they appear here with their latest vitals."
              />
            </View>
          ) : (
            cohort.map((m) => (
              <AnimatedPressable
                key={m.id}
                haptic="light"
                onPress={() => router.push(`/(app)/(care)/${m.id}`)}
                style={styles.memberCard}
              >
                <View style={styles.memberHead}>
                  <View
                    style={[
                      styles.ragDotLg,
                      { backgroundColor: RAG_COLOR[m.rag] },
                    ]}
                  />
                  <Avatar
                    uri={m.subPatient ? undefined : m.user.image}
                    name={m.subPatient?.name ?? m.user.name}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {m.subPatient?.name ?? m.user.name}
                    </Text>
                    <Text style={styles.memberMeta}>
                      {m.subPatient ? `Family of ${m.user.name} · ` : ""}
                      {m.program.name}
                      {m.adherence?.percent != null
                        ? ` · ${m.adherence.percent}% adherence`
                        : ` · ${m.readings7d} readings this week`}
                      {m.risk &&
                      (m.risk.level === "HIGH" || m.risk.level === "CRITICAL")
                        ? ` · ⚠ risk ${m.risk.level} (${m.risk.score}/100)`
                        : ""}
                    </Text>
                  </View>
                  {m.openAlerts > 0 ? (
                    <View style={styles.memberAlerts}>
                      <Ionicons name="alert" size={11} color="#fff" />
                      <Text style={styles.memberAlertsText}>
                        {m.openAlerts}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {Object.keys(m.latestByType).length > 0 ? (
                  <View style={styles.vitalsRow}>
                    {Object.entries(m.latestByType).map(([type, v]) => (
                      <View key={type} style={styles.vitalChip}>
                        <Text style={styles.vitalChipLabel}>
                          {vitalCatalog[type]?.label ?? type}
                        </Text>
                        <Text style={styles.vitalChipValue}>
                          {fmt(type, v)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noReadings}>
                    No readings logged yet — consider checking in
                  </Text>
                )}
              </AnimatedPressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: Space.xl, paddingBottom: 40 },

    ragRow: { flexDirection: "row", gap: 10 },
    ragCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 12,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    ragDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
    ragCount: {
      fontFamily: Fonts.extrabold,
      fontSize: 20,
      color: c.text.primary,
    },
    ragLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },

    sectionTitle: {
      ...Type.h2,
      color: c.text.primary,
      marginTop: 20,
      marginBottom: 10,
    },
    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 13,
      marginBottom: 8,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    sevStripe: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    alertMsg: { ...Type.bodySm, color: c.text.primary, lineHeight: 18 },
    alertMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },
    ackBtn: {
      backgroundColor: c.navySoft,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: Radius.round,
      minWidth: 96,
      alignItems: "center",
    },
    ackText: { fontFamily: Fonts.bold, fontSize: 12, color: c.navy },

    memberCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    memberHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    ragDotLg: { width: 11, height: 11, borderRadius: 6 },
    memberName: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    memberMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    memberAlerts: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: c.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radius.round,
    },
    memberAlertsText: { fontFamily: Fonts.bold, fontSize: 11.5, color: "#fff" },
    vitalsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    vitalChip: {
      backgroundColor: c.background,
      borderRadius: Radius.lg,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    vitalChipLabel: {
      ...Type.caption,
      fontSize: 10,
      color: c.text.tertiary,
    },
    vitalChipValue: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      color: c.text.primary,
      marginTop: 1,
    },
    noReadings: { ...Type.caption, color: c.text.tertiary, marginTop: 10 },
  });
