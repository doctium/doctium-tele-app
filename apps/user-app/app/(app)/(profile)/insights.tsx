import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
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
import { usersApi } from "../../../src/api/users.api";
import { formatMoney } from "../../../src/utils/money";

interface Insights {
  summary: {
    totalConsultations: number;
    completedConsultations: number;
    totalSpent: number;
    avgPerConsult: number;
    distinctDoctors: number;
    healthScore: number;
  };
  healthScoreFactors: {
    key: string;
    label: string;
    score: number;
    max: number;
    hint: string;
  }[];
  healthScoreSeries: { month: string; label: string; score: number }[];
  monthly: {
    month: string;
    label: string;
    consultations: number;
    spent: number;
  }[];
  bySpecialty: { specialty: string; count: number; spent: number }[];
}

const scoreTone = (score: number, c: Palette, t: (k: string) => string) =>
  score >= 75
    ? { word: t("insights.toneGreat"), color: c.success }
    : score >= 50
      ? { word: t("insights.toneGood"), color: c.teal }
      : { word: t("insights.toneNeedsAttention"), color: c.warning };

export default function HealthInsightsScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState(11);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    usersApi
      .getHealthInsights()
      .then((r: unknown) => setData((r as { data: Insights }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const score = data?.summary.healthScore ?? 0;
  const tone = scoreTone(score, colors, t);
  const monthly = data?.monthly ?? [];
  const maxSpent = Math.max(...monthly.map((m) => m.spent), 1);
  const selected = monthly[selMonth] ?? monthly.at(-1);
  const series = data?.healthScoreSeries ?? [];
  const maxSpecialty = Math.max(
    ...(data?.bySpecialty ?? []).map((s) => s.count),
    1,
  );

  return (
    <View style={styles.root}>
      <AppHeader title={t("insights.title")} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {/* ── Health score hero ── */}
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroBlob} />
            <View style={styles.scoreRing}>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreMax}>/ 100</Text>
            </View>
            <Text style={styles.scoreTitle}>
              {t("insights.engagementScore")}
            </Text>
            <View
              style={[
                styles.toneChip,
                { backgroundColor: "rgba(255,255,255,0.14)" },
              ]}
            >
              <View style={[styles.toneDot, { backgroundColor: tone.color }]} />
              <Text style={styles.toneText}>{tone.word}</Text>
            </View>
            {/* 6-month score trend */}
            <View style={styles.heroBars}>
              {series.map((s) => (
                <View key={s.month} style={styles.heroBarCol}>
                  <View style={styles.heroBarTrack}>
                    <View
                      style={[
                        styles.heroBar,
                        { height: 6 + (s.score / 100) * 44 },
                      ]}
                    />
                  </View>
                  <Text style={styles.heroBarLabel}>
                    {s.label.split(" ")[0]}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* ── Score factors ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>
              {t("insights.scoreBreakdown")}
            </Text>
            {(data?.healthScoreFactors ?? []).map((f, i) => (
              <View
                key={f.key}
                style={[i > 0 && styles.factorBorder, { paddingVertical: 10 }]}
              >
                <View style={styles.factorTop}>
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorScore}>
                    {f.score}
                    <Text style={styles.factorMax}> / {f.max}</Text>
                  </Text>
                </View>
                <View style={styles.factorTrack}>
                  <View
                    style={[
                      styles.factorFill,
                      {
                        width: `${Math.max(4, (f.score / f.max) * 100)}%`,
                        backgroundColor:
                          f.score / f.max >= 0.7 ? colors.teal : colors.warning,
                      },
                    ]}
                  />
                </View>
                {f.score / f.max < 0.7 ? (
                  <Text style={styles.factorHint}>{f.hint}</Text>
                ) : null}
              </View>
            ))}
          </View>

          {/* ── Care & spend summary ── */}
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {data?.summary.completedConsultations ?? 0}
              </Text>
              <Text style={styles.statLabel}>
                {t("insights.consultations")}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {data?.summary.distinctDoctors ?? 0}
              </Text>
              <Text style={styles.statLabel}>{t("insights.doctorsSeen")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text
                style={styles.statValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(data?.summary.totalSpent ?? 0)}
              </Text>
              <Text style={styles.statLabel}>{t("insights.totalSpent")}</Text>
            </View>
          </View>

          {/* ── 12-month activity & spending ── */}
          <View style={styles.sectionCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionLabel}>
                {t("insights.careActivity")}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.chartAmount}>
                  {formatMoney(selected?.spent ?? 0)}
                </Text>
                <Text style={styles.chartSub}>
                  {selected?.label ?? ""} ·{" "}
                  {t("insights.visits", {
                    count: selected?.consultations ?? 0,
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.chartBars}>
              {monthly.map((m, i) => {
                const h = 6 + (m.spent / maxSpent) * 70;
                const isSel = i === selMonth;
                return (
                  <AnimatedPressable
                    key={m.month}
                    haptic="light"
                    onPress={() => setSelMonth(i)}
                    style={styles.barCol}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor: isSel
                              ? colors.teal
                              : colors.navySoft,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.barLabel, isSel && styles.barLabelSel]}
                    >
                      {m.label.slice(0, 1)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            <Text style={styles.avgNote}>
              {t("insights.avgPerConsult", {
                amount: formatMoney(data?.summary.avgPerConsult ?? 0),
              })}
            </Text>
          </View>

          {/* ── By specialty ── */}
          {(data?.bySpecialty ?? []).length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>
                {t("insights.careBySpecialty")}
              </Text>
              {(data?.bySpecialty ?? []).map((s, i) => (
                <View
                  key={s.specialty}
                  style={[
                    i > 0 && styles.factorBorder,
                    { paddingVertical: 10 },
                  ]}
                >
                  <View style={styles.factorTop}>
                    <Text style={styles.factorLabel}>{s.specialty}</Text>
                    <Text style={styles.specialtySpend}>
                      {formatMoney(s.spent)}
                    </Text>
                  </View>
                  <View style={styles.factorTrack}>
                    <View
                      style={[
                        styles.factorFill,
                        {
                          width: `${Math.max(6, (s.count / maxSpecialty) * 100)}%`,
                          backgroundColor: colors.navyMid,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.factorHint}>
                    {s.count === 1
                      ? t("insights.consultationCountOne", { count: s.count })
                      : t("insights.consultationCountMany", { count: s.count })}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons
                name="pulse-outline"
                size={28}
                color={colors.text.tertiary}
              />
              <Text style={styles.emptyTitle}>{t("insights.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("insights.emptyDesc")}</Text>
            </View>
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

    hero: {
      borderRadius: Radius.xxl,
      padding: 24,
      alignItems: "center",
      overflow: "hidden",
      ...Shadow.raised,
    },
    heroBlob: {
      position: "absolute",
      top: -50,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(139,187,233,0.16)",
    },
    scoreRing: {
      width: 124,
      height: 124,
      borderRadius: 62,
      borderWidth: 7,
      borderColor: "rgba(255,255,255,0.28)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    scoreValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 42,
      color: "#fff",
      letterSpacing: -1.2,
    },
    scoreMax: { ...Type.caption, color: c.text.onDarkDim, marginTop: -4 },
    scoreTitle: { ...Type.label, color: c.text.onDarkDim, marginTop: 14 },
    toneChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.round,
      marginTop: 8,
    },
    toneDot: { width: 8, height: 8, borderRadius: 4 },
    toneText: { fontFamily: Fonts.bold, fontSize: 13, color: "#fff" },
    heroBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      marginTop: 18,
      alignSelf: "stretch",
      justifyContent: "center",
    },
    heroBarCol: { alignItems: "center", gap: 5, width: 34 },
    heroBarTrack: {
      height: 52,
      justifyContent: "flex-end",
      alignItems: "center",
    },
    heroBar: {
      width: 16,
      borderRadius: 5,
      backgroundColor: "rgba(255,255,255,0.65)",
    },
    heroBarLabel: {
      ...Type.caption,
      fontSize: 10,
      color: c.text.onDarkDim,
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
      marginBottom: 8,
    },

    factorBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    factorTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 7,
    },
    factorLabel: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
    },
    factorScore: {
      fontFamily: Fonts.bold,
      fontSize: 13.5,
      color: c.text.primary,
    },
    factorMax: { fontFamily: Fonts.medium, color: c.text.tertiary },
    factorTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: c.background,
      overflow: "hidden",
    },
    factorFill: { height: "100%", borderRadius: 4 },
    factorHint: { ...Type.caption, color: c.text.tertiary, marginTop: 6 },
    specialtySpend: {
      fontFamily: Fonts.bold,
      fontSize: 13.5,
      color: c.teal,
    },

    statRow: { flexDirection: "row", gap: 10, marginTop: 12 },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    statValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 16,
      color: c.text.primary,
      letterSpacing: -0.3,
    },
    statLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },

    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
    },
    chartAmount: {
      fontFamily: Fonts.extrabold,
      fontSize: 17,
      color: c.text.primary,
      letterSpacing: -0.4,
    },
    chartSub: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
    barCol: { flex: 1, alignItems: "center", gap: 6 },
    barTrack: {
      height: 78,
      justifyContent: "flex-end",
      width: "100%",
      alignItems: "center",
    },
    bar: { width: "72%", maxWidth: 20, borderRadius: 6, minHeight: 6 },
    barLabel: { ...Type.caption, fontSize: 10, color: c.text.tertiary },
    barLabelSel: { color: c.navy, fontFamily: Fonts.bold },
    avgNote: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 12,
      textAlign: "center",
    },

    emptyCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 28,
      marginTop: 12,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    emptyTitle: { ...Type.h3, color: c.text.primary, marginTop: 10 },
    emptyText: {
      ...Type.bodySm,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 4,
    },
  });
