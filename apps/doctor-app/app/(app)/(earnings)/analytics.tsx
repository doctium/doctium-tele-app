import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
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
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";
import { formatMoney } from "../../../src/utils/money";

interface MonthPoint {
  month: string;
  label: string;
  earnings: number;
  consultations: number;
}
interface Analytics {
  premium: boolean;
  planCode: string | null;
  basic: {
    currency: string;
    totalConsultations: number;
    completedConsultations: number;
    cancelledConsultations: number;
    completionRate: number;
    uniquePatients: number;
    thisMonthEarnings: number;
    rating: number;
    reviewCount: number;
  };
  advanced: null | {
    earningsTrend: MonthPoint[];
    cancellationTrend: {
      label: string;
      completed: number;
      cancelled: number;
      rate: number;
    }[];
    retention: {
      uniquePatients: number;
      returningPatients: number;
      newPatients: number;
      retentionRate: number;
      avgConsultsPerPatient: number;
    };
    patientMix: {
      label: string;
      newPatients: number;
      returningPatients: number;
    }[];
    peakHours: { hour: number; count: number }[];
    peakDays: { day: string; count: number }[];
    topServices: { name: string; count: number; earnings: number }[];
    ratingTrend: { label: string; rating: number | null; reviews: number }[];
  };
}

const PREMIUM_BULLETS = [
  "12-month earnings & consultation trends",
  "Patient retention and repeat-visit rate",
  "Peak booking hours & busiest days",
  "Cancellation, service & rating breakdowns",
];

export default function PracticeAnalyticsScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState(11);

  useEffect(() => {
    doctorApi
      .getPracticeAnalytics()
      .then((r: unknown) => setData((r as { data: Analytics }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const adv = data?.advanced;
  const trend = adv?.earningsTrend ?? [];
  const maxEarn = Math.max(...trend.map((t) => t.earnings), 1);
  const selected = trend[selMonth] ?? trend.at(-1);

  const busiest = useMemo(() => {
    const hours = adv?.peakHours ?? [];
    if (!hours.length) return null;
    const top = [...hours].sort((a, b) => b.count - a.count)[0];
    if (!top || top.count === 0) return null;
    return top;
  }, [adv]);
  const maxHour = Math.max(...(adv?.peakHours ?? []).map((h) => h.count), 1);
  const maxDay = Math.max(...(adv?.peakDays ?? []).map((d) => d.count), 1);
  const maxMix = Math.max(
    ...(adv?.patientMix ?? []).map((m) => m.newPatients + m.returningPatients),
    1,
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Practice analytics" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {/* ── Always-free overview ── */}
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: "rgba(44,183,167,0.12)" },
                ]}
              >
                <Ionicons name="checkmark-done" size={15} color={colors.teal} />
              </View>
              <Text style={styles.statValue}>
                {data?.basic.completionRate ?? 0}%
              </Text>
              <Text style={styles.statLabel}>Completion rate</Text>
            </View>
            <View style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: "rgba(28,74,116,0.10)" },
                ]}
              >
                <Ionicons name="people" size={15} color={colors.navyMid} />
              </View>
              <Text style={styles.statValue}>
                {data?.basic.uniquePatients ?? 0}
              </Text>
              <Text style={styles.statLabel}>Patients</Text>
            </View>
            <View style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: "rgba(247,144,9,0.14)" },
                ]}
              >
                <Ionicons name="star" size={15} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>
                {(data?.basic.rating ?? 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>
                {data?.basic.reviewCount ?? 0} reviews
              </Text>
            </View>
          </View>

          <View style={styles.monthCard}>
            <Text style={styles.monthLabel}>Earned this month</Text>
            <Text style={styles.monthValue}>
              {formatMoney(
                data?.basic.thisMonthEarnings ?? 0,
                data?.basic.currency,
              )}
            </Text>
            <Text style={styles.monthSub}>
              {data?.basic.completedConsultations ?? 0} consultations completed
              all-time · {data?.basic.cancelledConsultations ?? 0} cancelled
            </Text>
          </View>

          {/* ── Premium tier ── */}
          {!adv ? (
            <LinearGradient
              colors={Gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upsell}
            >
              <View style={styles.upsellBlob} />
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={18} color="#fff" />
              </View>
              <Text style={styles.upsellTitle}>Advanced analytics</Text>
              <Text style={styles.upsellSub}>
                Understand your practice like a business — included with a
                DoctiumPlus doctor plan.
              </Text>
              {PREMIUM_BULLETS.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Ionicons
                    name="sparkles"
                    size={13}
                    color={colors.tealBright}
                  />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
              <Button
                label="Upgrade with DoctiumPlus"
                onPress={() => router.push("/(app)/(subscription)")}
                style={{ marginTop: 18 }}
              />
            </LinearGradient>
          ) : (
            <>
              {/* Earnings trend */}
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Earnings · 12 months</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.chartAmount}>
                      {formatMoney(
                        selected?.earnings ?? 0,
                        data?.basic.currency,
                      )}
                    </Text>
                    <Text style={styles.chartDay}>
                      {selected?.label ?? ""} · {selected?.consultations ?? 0}{" "}
                      consults
                    </Text>
                  </View>
                </View>
                <View style={styles.chartBars}>
                  {trend.map((m, i) => {
                    const h = 8 + (m.earnings / maxEarn) * 78;
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
                          style={[
                            styles.barLabelTiny,
                            isSel && styles.barLabelSel,
                          ]}
                        >
                          {m.label.slice(0, 1)}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>

              {/* Retention */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Patient retention</Text>
                <View style={styles.retentionRow}>
                  <View style={styles.retentionBig}>
                    <Text style={styles.retentionValue}>
                      {adv.retention.retentionRate}%
                    </Text>
                    <Text style={styles.retentionHint}>
                      come back for more visits
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={styles.kvRow}>
                      <Text style={styles.kvKey}>Returning patients</Text>
                      <Text style={styles.kvVal}>
                        {adv.retention.returningPatients}
                      </Text>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={styles.kvKey}>One-time patients</Text>
                      <Text style={styles.kvVal}>
                        {adv.retention.newPatients}
                      </Text>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={styles.kvKey}>Avg visits / patient</Text>
                      <Text style={styles.kvVal}>
                        {adv.retention.avgConsultsPerPatient}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* New vs returning per month */}
                <View style={[styles.chartBars, { marginTop: 16 }]}>
                  {adv.patientMix.map((m) => {
                    const total = m.newPatients + m.returningPatients;
                    const hNew = (m.newPatients / maxMix) * 64;
                    const hRet = (m.returningPatients / maxMix) * 64;
                    return (
                      <View key={m.label} style={styles.barCol}>
                        <View style={[styles.barTrack, { height: 70 }]}>
                          <View
                            style={[
                              styles.stackBar,
                              {
                                height: Math.max(total ? 4 : 2, hRet),
                                backgroundColor: colors.teal,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.stackBar,
                              {
                                height: Math.max(total ? 4 : 2, hNew),
                                backgroundColor: colors.navySoft,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabelTiny}>
                          {m.label.split(" ")[0]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.legendRow}>
                  <View
                    style={[styles.legendDot, { backgroundColor: colors.teal }]}
                  />
                  <Text style={styles.legendText}>Returning</Text>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: colors.navySoft },
                    ]}
                  />
                  <Text style={styles.legendText}>New</Text>
                </View>
              </View>

              {/* Peak hours */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Peak booking hours</Text>
                {busiest ? (
                  <Text style={styles.peakHint}>
                    Busiest around{" "}
                    <Text
                      style={{
                        fontFamily: Fonts.bold,
                        color: colors.text.primary,
                      }}
                    >
                      {String(busiest.hour).padStart(2, "0")}:00–
                      {String((busiest.hour + 1) % 24).padStart(2, "0")}:00
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.peakHint}>No bookings yet</Text>
                )}
                <View style={styles.heatRow}>
                  {adv.peakHours.map((h) => (
                    <View
                      key={h.hour}
                      style={[
                        styles.heatCell,
                        {
                          backgroundColor: `rgba(44,183,167,${
                            h.count === 0
                              ? 0.07
                              : 0.18 + (h.count / maxHour) * 0.72
                          })`,
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.heatLabels}>
                  {["12am", "6am", "12pm", "6pm", "11pm"].map((l) => (
                    <Text key={l} style={styles.barLabelTiny}>
                      {l}
                    </Text>
                  ))}
                </View>
                {/* Busiest days */}
                <View style={[styles.chartBars, { marginTop: 18 }]}>
                  {adv.peakDays.map((d) => (
                    <View key={d.day} style={styles.barCol}>
                      <View style={[styles.barTrack, { height: 56 }]}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: 6 + (d.count / maxDay) * 48,
                              backgroundColor:
                                d.count === maxDay
                                  ? colors.teal
                                  : colors.navySoft,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabelTiny}>{d.day}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Top services */}
              {adv.topServices.length > 0 ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>Top services</Text>
                  {adv.topServices.map((s, i) => (
                    <View
                      key={s.name}
                      style={[
                        styles.serviceRow,
                        i > 0 && styles.serviceRowBorder,
                      ]}
                    >
                      <View style={styles.serviceRank}>
                        <Text style={styles.serviceRankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{s.name}</Text>
                        <Text style={styles.serviceMeta}>
                          {s.count} consults
                        </Text>
                      </View>
                      <Text style={styles.serviceEarn}>
                        {formatMoney(s.earnings, data?.basic.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Cancellations + rating */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Quality · last 6 months</Text>
                {adv.cancellationTrend.map((m, i) => {
                  const rating = adv.ratingTrend[i];
                  return (
                    <View
                      key={m.label}
                      style={[
                        styles.serviceRow,
                        i > 0 && styles.serviceRowBorder,
                      ]}
                    >
                      <Text style={[styles.serviceName, { width: 64 }]}>
                        {m.label}
                      </Text>
                      <Text style={[styles.serviceMeta, { flex: 1 }]}>
                        {m.completed} done · {m.cancelled} cancelled ({m.rate}%)
                      </Text>
                      <View style={styles.ratingChip}>
                        <Ionicons
                          name="star"
                          size={11}
                          color={colors.warning}
                        />
                        <Text style={styles.ratingChipText}>
                          {rating?.rating != null
                            ? rating.rating.toFixed(1)
                            : "—"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
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

    statRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    statIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    statValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 17,
      color: c.text.primary,
      letterSpacing: -0.3,
    },
    statLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },

    monthCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 18,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    monthLabel: { ...Type.label, color: c.text.secondary },
    monthValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 30,
      color: c.text.primary,
      letterSpacing: -0.8,
      marginTop: 8,
    },
    monthSub: { ...Type.caption, color: c.text.tertiary, marginTop: 4 },

    upsell: {
      borderRadius: Radius.xxl,
      padding: 24,
      marginTop: 16,
      overflow: "hidden",
      ...Shadow.raised,
    },
    upsellBlob: {
      position: "absolute",
      top: -40,
      right: -30,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: "rgba(139,187,233,0.2)",
    },
    lockBadge: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    upsellTitle: {
      fontFamily: Fonts.extrabold,
      fontSize: 22,
      color: "#fff",
      letterSpacing: -0.4,
    },
    upsellSub: {
      ...Type.bodySm,
      color: c.text.onDarkDim,
      marginTop: 6,
      marginBottom: 14,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
    },
    bulletText: { ...Type.bodySm, color: "#fff", flex: 1 },

    chartCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 18,
      marginTop: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    chartTitle: { ...Type.label, color: c.text.secondary },
    chartAmount: {
      fontFamily: Fonts.extrabold,
      fontSize: 18,
      color: c.text.primary,
      letterSpacing: -0.4,
    },
    chartDay: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
    barCol: { flex: 1, alignItems: "center", gap: 6 },
    barTrack: {
      height: 86,
      justifyContent: "flex-end",
      width: "100%",
      alignItems: "center",
    },
    bar: { width: "72%", maxWidth: 22, borderRadius: 6, minHeight: 6 },
    stackBar: { width: "72%", maxWidth: 22, borderRadius: 4, marginTop: 2 },
    barLabelTiny: {
      ...Type.caption,
      fontSize: 10,
      color: c.text.tertiary,
    },
    barLabelSel: { color: c.navy, fontFamily: Fonts.bold },

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
      marginBottom: 12,
    },

    retentionRow: { flexDirection: "row", gap: 16, alignItems: "center" },
    retentionBig: {
      width: 116,
      height: 116,
      borderRadius: 58,
      borderWidth: 6,
      borderColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
      padding: 8,
    },
    retentionValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 24,
      color: c.text.primary,
      letterSpacing: -0.5,
    },
    retentionHint: {
      ...Type.caption,
      fontSize: 9.5,
      color: c.text.tertiary,
      textAlign: "center",
    },
    kvRow: { flexDirection: "row", justifyContent: "space-between" },
    kvKey: { ...Type.bodySm, color: c.text.secondary },
    kvVal: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      justifyContent: "center",
    },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
    legendText: { ...Type.caption, color: c.text.tertiary },

    peakHint: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginBottom: 12,
    },
    heatRow: { flexDirection: "row", gap: 2 },
    heatCell: { flex: 1, height: 26, borderRadius: 4 },
    heatLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },

    serviceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
    },
    serviceRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    serviceRank: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    serviceRankText: {
      fontFamily: Fonts.bold,
      fontSize: 12.5,
      color: c.navyMid,
    },
    serviceName: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
    },
    serviceMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    serviceEarn: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.teal,
    },
    ratingChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(247,144,9,0.10)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radius.round,
    },
    ratingChipText: {
      fontFamily: Fonts.bold,
      fontSize: 12,
      color: c.text.primary,
    },
  });
