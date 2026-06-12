import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
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
import { AppHeader } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { doctorApi } from "../../../src/api/doctor.api";

interface Summary {
  nps: number | null;
  nps90: number | null;
  platformNps90: number | null;
  counts: { promoters: number; passives: number; detractors: number };
  totalResponses: number;
  responseRate: number;
  wouldBookAgainRate: number | null;
  trend: {
    month: string;
    label: string;
    nps: number | null;
    responses: number;
  }[];
  categories: {
    key: string;
    label: string;
    mine: number | null;
    platform: number | null;
  }[];
  comments: {
    comment: string;
    npsScore: number | null;
    respondedAt: string | null;
  }[];
  recommendations: {
    severity: "HIGH" | "MEDIUM" | "INFO";
    key: string;
    title: string;
    detail: string;
  }[];
}

const makeSeverityStyle = (c: Palette) => ({
  HIGH: {
    bg: "rgba(240,103,92,0.10)",
    color: c.error,
    icon: "alert-circle" as const,
  },
  MEDIUM: {
    bg: "rgba(247,144,9,0.10)",
    color: c.warning,
    icon: "bulb" as const,
  },
  INFO: {
    bg: "rgba(44,183,167,0.10)",
    color: c.teal,
    icon: "checkmark-circle" as const,
  },
});

export default function PatientFeedbackScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const SEVERITY_STYLE = makeSeverityStyle(colors);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    doctorApi
      .getSatisfactionSummary()
      .then((r: unknown) => setData((r as { data: Summary }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total =
    (data?.counts.promoters ?? 0) +
    (data?.counts.passives ?? 0) +
    (data?.counts.detractors ?? 0);

  return (
    <View style={styles.root}>
      <AppHeader title="Patient feedback" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : !data || data.totalResponses === 0 ? (
        <View style={{ marginTop: 30, paddingHorizontal: Space.xl }}>
          <EmptyState
            icon="happy-outline"
            title="No feedback yet"
            description="Patients get a short satisfaction survey 24 hours after each consultation. Responses appear here."
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {/* ── NPS hero ── */}
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroBlob} />
            <Text style={styles.heroLabel}>Net Promoter Score · 90 days</Text>
            <Text style={styles.heroNps}>
              {data.nps90 != null
                ? data.nps90 > 0
                  ? `+${data.nps90}`
                  : data.nps90
                : "—"}
            </Text>
            <Text style={styles.heroSub}>
              Platform average{" "}
              {data.platformNps90 != null
                ? data.platformNps90 > 0
                  ? `+${data.platformNps90}`
                  : data.platformNps90
                : "—"}{" "}
              · {data.totalResponses} responses · {data.responseRate}% response
              rate
            </Text>
            {/* promoter mix bar */}
            {total > 0 ? (
              <View style={styles.mixBar}>
                <View
                  style={[
                    styles.mixSeg,
                    {
                      flex: Math.max(data.counts.promoters, 0.001),
                      backgroundColor: colors.teal,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.mixSeg,
                    {
                      flex: Math.max(data.counts.passives, 0.001),
                      backgroundColor: "rgba(255,255,255,0.45)",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.mixSeg,
                    {
                      flex: Math.max(data.counts.detractors, 0.001),
                      backgroundColor: "#F0675C",
                    },
                  ]}
                />
              </View>
            ) : null}
            <View style={styles.mixLegend}>
              <Text style={styles.mixText}>
                {data.counts.promoters} promoters
              </Text>
              <Text style={styles.mixText}>{data.counts.passives} passive</Text>
              <Text style={styles.mixText}>
                {data.counts.detractors} detractors
              </Text>
            </View>
          </LinearGradient>

          {/* ── Recommendations ── */}
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {data.recommendations.map((r) => {
            const s = SEVERITY_STYLE[r.severity];
            return (
              <View
                key={r.key}
                style={[styles.recCard, { backgroundColor: s.bg }]}
              >
                <Ionicons name={s.icon} size={18} color={s.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{r.title}</Text>
                  <Text style={styles.recDetail}>{r.detail}</Text>
                </View>
              </View>
            );
          })}

          {/* ── Category benchmarks ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>
              Feedback categories · you vs platform
            </Text>
            {data.categories.map((c) => (
              <View key={c.key} style={styles.catBlock}>
                <View style={styles.catTop}>
                  <Text style={styles.catLabel}>{c.label}</Text>
                  <Text style={styles.catScore}>
                    {c.mine != null ? `${c.mine}/5` : "—"}
                    <Text style={styles.catPlatform}>
                      {"  "}· platform {c.platform != null ? c.platform : "—"}
                    </Text>
                  </Text>
                </View>
                <View style={styles.catTrack}>
                  <View
                    style={[
                      styles.catFill,
                      {
                        width: `${((c.mine ?? 0) / 5) * 100}%`,
                        backgroundColor:
                          (c.mine ?? 0) >= 4
                            ? colors.teal
                            : (c.mine ?? 0) >= 3.5
                              ? colors.navyMid
                              : colors.warning,
                      },
                    ]}
                  />
                  {c.platform != null ? (
                    <View
                      style={[
                        styles.platformTick,
                        { left: `${(c.platform / 5) * 100}%` },
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
            {data.wouldBookAgainRate != null ? (
              <Text style={styles.bookAgainNote}>
                {data.wouldBookAgainRate}% of recent patients would book you
                again
              </Text>
            ) : null}
          </View>

          {/* ── NPS trend ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>NPS trend · 6 months</Text>
            <View style={styles.trendRow}>
              {data.trend.map((m) => {
                const v = m.nps;
                const h =
                  v == null
                    ? 4
                    : 8 + (Math.max(-100, Math.min(100, v)) + 100) * 0.31;
                return (
                  <View key={m.month} style={styles.trendCol}>
                    <Text style={styles.trendVal}>
                      {v == null ? "—" : v > 0 ? `+${v}` : v}
                    </Text>
                    <View style={styles.trendTrack}>
                      <View
                        style={[
                          styles.trendBar,
                          {
                            height: h,
                            backgroundColor:
                              v == null
                                ? colors.border
                                : v >= 30
                                  ? colors.teal
                                  : v >= 0
                                    ? colors.navySoft
                                    : "#F0675C",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.trendLabel}>
                      {m.label.split(" ")[0]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Anonymized comments ── */}
          {data.comments.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>
                What patients said (anonymous)
              </Text>
              {data.comments.map((c, i) => (
                <View
                  key={i}
                  style={[styles.commentRow, i > 0 && styles.commentBorder]}
                >
                  <View
                    style={[
                      styles.commentScore,
                      {
                        backgroundColor:
                          (c.npsScore ?? 0) >= 9
                            ? "rgba(44,183,167,0.12)"
                            : (c.npsScore ?? 0) >= 7
                              ? "rgba(247,144,9,0.12)"
                              : "rgba(240,103,92,0.12)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.commentScoreText,
                        {
                          color:
                            (c.npsScore ?? 0) >= 9
                              ? colors.teal
                              : (c.npsScore ?? 0) >= 7
                                ? colors.warning
                                : colors.error,
                        },
                      ]}
                    >
                      {c.npsScore ?? "—"}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{c.comment}</Text>
                </View>
              ))}
            </View>
          ) : null}
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

    hero: {
      borderRadius: Radius.xxl,
      padding: 24,
      overflow: "hidden",
      ...Shadow.raised,
    },
    heroBlob: {
      position: "absolute",
      top: -40,
      right: -30,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: "rgba(139,187,233,0.2)",
    },
    heroLabel: {
      ...Type.label,
      color: c.text.onDarkDim,
      letterSpacing: 0.4,
    },
    heroNps: {
      fontFamily: Fonts.extrabold,
      fontSize: 46,
      color: "#fff",
      letterSpacing: -1.4,
      marginTop: 10,
    },
    heroSub: { ...Type.bodySm, color: c.text.onDarkDim, marginTop: 4 },
    mixBar: {
      flexDirection: "row",
      height: 10,
      borderRadius: 5,
      overflow: "hidden",
      marginTop: 16,
      gap: 2,
    },
    mixSeg: { height: "100%", borderRadius: 5 },
    mixLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    mixText: { ...Type.caption, fontSize: 10.5, color: c.text.onDarkDim },

    sectionTitle: {
      ...Type.h2,
      color: c.text.primary,
      marginTop: 20,
      marginBottom: 10,
    },
    recCard: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: Radius.lg,
      marginBottom: 10,
      alignItems: "flex-start",
    },
    recTitle: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    recDetail: {
      ...Type.caption,
      color: c.text.secondary,
      marginTop: 4,
      lineHeight: 17,
    },

    sectionCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 18,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    sectionLabel: {
      ...Type.label,
      color: c.text.secondary,
      marginBottom: 14,
    },

    catBlock: { marginBottom: 14 },
    catTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 7,
    },
    catLabel: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
    },
    catScore: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      color: c.text.primary,
    },
    catPlatform: {
      fontFamily: Fonts.medium,
      fontSize: 11.5,
      color: c.text.tertiary,
    },
    catTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.background,
    },
    catFill: { height: "100%", borderRadius: 4 },
    platformTick: {
      position: "absolute",
      top: -3,
      width: 2,
      height: 14,
      borderRadius: 1,
      backgroundColor: c.navy,
    },
    bookAgainNote: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 4,
    },

    trendRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    trendCol: { flex: 1, alignItems: "center", gap: 5 },
    trendVal: {
      ...Type.caption,
      fontSize: 10.5,
      fontFamily: Fonts.bold,
      color: c.text.secondary,
    },
    trendTrack: {
      height: 72,
      justifyContent: "flex-end",
      alignItems: "center",
      width: "100%",
    },
    trendBar: { width: "62%", maxWidth: 24, borderRadius: 6, minHeight: 4 },
    trendLabel: { ...Type.caption, fontSize: 10, color: c.text.tertiary },

    commentRow: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 12,
      alignItems: "flex-start",
    },
    commentBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    commentScore: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    commentScoreText: { fontFamily: Fonts.extrabold, fontSize: 14 },
    commentText: {
      ...Type.bodySm,
      color: c.text.secondary,
      flex: 1,
      lineHeight: 19,
    },
  });
