import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface VitalMeta {
  label: string;
  unit: string;
  hasSecond: boolean;
}
interface VitalConfig {
  type: string;
  min?: number;
  max?: number;
  criticalMin?: number;
  criticalMax?: number;
  min2?: number;
  max2?: number;
  criticalMax2?: number;
}
interface ReadingPoint {
  value: number;
  value2: number | null;
  takenAt: string;
}
interface Goal {
  id: string;
  type: string;
  title: string;
  status: "ACTIVE" | "ACHIEVED" | "MISSED" | "CANCELLED";
  dueDate: string | null;
  progress: number | null;
}
interface AlertRow {
  id: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  acknowledgedAt: string | null;
  createdAt: string;
}
interface Crisis {
  id: string;
  painScore: number;
  sites: string[];
  triggers: string[];
  treatment: string;
  hospitalized: boolean;
  startedAt: string;
  resolvedAt: string | null;
}
interface CrisisStats {
  count90d: number;
  hospitalizations90d: number;
  avgPain: number | null;
  avgDurationHours: number | null;
  topTriggers: { trigger: string; count: number }[];
}
interface ThresholdSuggestion {
  min?: number;
  max?: number;
  basis: { count: number; median: number; p10: number; p90: number };
  rationale: string;
}
interface Risk {
  score: number;
  level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factors: { key: string; label: string; points: number }[];
}
interface LabFlag {
  key: string;
  severity: "WARNING" | "CRITICAL";
  label: string;
}
interface Lab {
  id: string;
  hb: number | null;
  wbc: number | null;
  anc: number | null;
  platelets: number | null;
  mcv: number | null;
  flags: LabFlag[];
  source: string;
  takenAt: string;
}
interface DosePeriod {
  id: string;
  doseMgPerDay: number;
  weightKg: number | null;
  note: string;
  startedAt: string;
  crisesDuring: number;
  avgHbDuring: number | null;
}
interface Titration {
  currentDose: DosePeriod | null;
  mgPerKg: number | null;
  maxDailyMg: number | null;
  doseHistory: DosePeriod[];
  labs: Lab[];
  flags: LabFlag[];
  dueReasons: string[];
}
interface Detail {
  id: string;
  status: string;
  genotype?: string;
  program: { name: string };
  user: { id: string; name: string; image: string };
  subPatient: { id: string; name: string } | null;
  vitals: VitalConfig[];
  vitalCatalog: Record<string, VitalMeta>;
  readingsByType: Record<string, ReadingPoint[]>;
  goals: Goal[];
  alerts: AlertRow[];
  adherence: {
    expectedPerWeek: number;
    readings7d: number;
    percent: number | null;
  } | null;
  crises?: Crisis[];
  crisisStats?: CrisisStats;
  suggestedThresholds?: Record<string, ThresholdSuggestion>;
  risk?: Risk | null;
}

const DAY_MS = 86_400_000;

export default function CarePatientScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Goal sheet
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalType, setGoalType] = useState<string | null>(null);
  const [direction, setDirection] = useState<"AT_OR_BELOW" | "AT_OR_ABOVE">(
    "AT_OR_BELOW",
  );
  const [target, setTarget] = useState("");
  const [target2, setTarget2] = useState("");
  const [dueDays, setDueDays] = useState<number | null>(30);

  // Threshold sheet
  const [threshType, setThreshType] = useState<string | null>(null);
  const [tMin, setTMin] = useState("");
  const [tMax, setTMax] = useState("");
  const [tMax2, setTMax2] = useState("");

  // Titration (SCD Phase 5)
  const [titration, setTitration] = useState<Titration | null>(null);
  const [doseOpen, setDoseOpen] = useState(false);
  const [doseMg, setDoseMg] = useState("");
  const [doseWeight, setDoseWeight] = useState("");
  const [doseNote, setDoseNote] = useState("");
  const [labOpen, setLabOpen] = useState(false);
  const [labVals, setLabVals] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!id) return;
    doctorApi
      .getCareEnrollment(id)
      .then((r: unknown) => setDetail((r as { data: Detail }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
    doctorApi
      .getCareTitration(id)
      .then((r: unknown) => setTitration((r as { data: Titration }).data))
      .catch(() => setTitration(null));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const ack = async (alertId: string) => {
    setBusy(alertId);
    try {
      await doctorApi.ackCareAlert(alertId);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const cancelGoal = async (goalId: string) => {
    setBusy(goalId);
    try {
      await doctorApi.cancelCareGoal(goalId);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const openGoalSheet = () => {
    const first = detail?.vitals[0]?.type ?? null;
    setGoalType(first);
    setDirection("AT_OR_BELOW");
    setTarget("");
    setTarget2("");
    setDueDays(30);
    setGoalOpen(true);
  };

  const submitGoal = async () => {
    if (!id || !goalType) return;
    const v = parseFloat(target);
    if (!Number.isFinite(v)) return;
    const meta = detail?.vitalCatalog[goalType];
    const v2 = meta?.hasSecond && target2 ? parseFloat(target2) : undefined;
    setBusy("goal");
    try {
      await doctorApi.createCareGoal(id, {
        type: goalType,
        direction,
        targetValue: v,
        targetValue2: Number.isFinite(v2 as number) ? v2 : undefined,
        dueDate: dueDays
          ? new Date(Date.now() + dueDays * DAY_MS).toISOString()
          : undefined,
      });
      setGoalOpen(false);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const openThreshSheet = (cfg: VitalConfig) => {
    setThreshType(cfg.type);
    setTMin(cfg.min != null ? String(cfg.min) : "");
    setTMax(cfg.max != null ? String(cfg.max) : "");
    setTMax2(cfg.max2 != null ? String(cfg.max2) : "");
  };

  const submitThresholds = async () => {
    if (!id || !threshType) return;
    const entry: Record<string, number> = {};
    const mn = parseFloat(tMin);
    const mx = parseFloat(tMax);
    const mx2 = parseFloat(tMax2);
    if (Number.isFinite(mn)) entry.min = mn;
    if (Number.isFinite(mx)) entry.max = mx;
    if (Number.isFinite(mx2)) entry.max2 = mx2;
    if (!Object.keys(entry).length) return;
    setBusy("thresh");
    try {
      await doctorApi.updateCareThresholds(id, { [threshType]: entry });
      setThreshType(null);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  // ── Titration (SCD Phase 5) ──
  const openDoseSheet = () => {
    setDoseMg(
      titration?.currentDose ? String(titration.currentDose.doseMgPerDay) : "",
    );
    setDoseWeight(
      titration?.currentDose?.weightKg
        ? String(titration.currentDose.weightKg)
        : "",
    );
    setDoseNote("");
    setDoseOpen(true);
  };

  const submitDose = async () => {
    if (!id) return;
    const mg = parseInt(doseMg, 10);
    if (!Number.isFinite(mg)) return;
    const kg = parseFloat(doseWeight);
    setBusy("dose");
    try {
      await doctorApi.setCareDose(id, {
        doseMgPerDay: mg,
        weightKg: Number.isFinite(kg) ? kg : undefined,
        note: doseNote.trim() || undefined,
      });
      setDoseOpen(false);
      load();
    } catch (e) {
      Alert.alert(
        "Couldn't save dose",
        (e as { message?: string })?.message ?? "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const submitLab = async () => {
    if (!id) return;
    const payload: Record<string, number> = {};
    for (const k of ["hb", "wbc", "anc", "platelets", "mcv"]) {
      const v = parseFloat(labVals[k] ?? "");
      if (Number.isFinite(v)) payload[k] = v;
    }
    if (!Object.keys(payload).length) return;
    setBusy("lab");
    try {
      await doctorApi.recordCareLab(id, payload);
      setLabOpen(false);
      setLabVals({});
      load();
    } catch (e) {
      Alert.alert(
        "Couldn't save labs",
        (e as { message?: string })?.message ?? "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const labLine = (l: Lab) =>
    [
      l.hb != null ? `Hb ${l.hb}` : null,
      l.wbc != null ? `WBC ${l.wbc}` : null,
      l.anc != null ? `ANC ${l.anc}` : null,
      l.platelets != null ? `Plt ${l.platelets}` : null,
      l.mcv != null ? `MCV ${l.mcv}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  /**
   * Baseline learner (SCD Phase 3): apply the suggested warning band as a
   * per-patient threshold override through the normal thresholds endpoint.
   */
  const applySuggestion = async (type: string, s: ThresholdSuggestion) => {
    if (!id) return;
    const entry: Record<string, number> = {};
    if (s.min != null) entry.min = s.min;
    if (s.max != null) entry.max = s.max;
    if (!Object.keys(entry).length) return;
    setBusy(`suggest:${type}`);
    try {
      await doctorApi.updateCareThresholds(id, { [type]: entry });
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const fmt = (type: string, p: { value: number; value2: number | null }) => {
    const meta = detail?.vitalCatalog[type];
    const v =
      meta?.hasSecond && p.value2 != null
        ? `${p.value}/${p.value2}`
        : `${p.value}`;
    return `${v} ${meta?.unit ?? ""}`.trim();
  };

  const goalMeta = goalType ? detail?.vitalCatalog[goalType] : null;
  const threshMeta = threshType ? detail?.vitalCatalog[threshType] : null;
  const visibleGoals = (detail?.goals ?? []).filter(
    (g) => g.status !== "CANCELLED",
  );
  const openAlerts = (detail?.alerts ?? []).filter((a) => !a.acknowledgedAt);

  return (
    <View style={styles.root}>
      <AppHeader title="Patient progress" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : !detail ? null : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {/* ── Patient header ── */}
          <View style={styles.headCard}>
            <Avatar
              uri={detail.subPatient ? undefined : detail.user.image}
              name={detail.subPatient?.name ?? detail.user.name}
              size={48}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>
                {detail.subPatient?.name ?? detail.user.name}
              </Text>
              <Text style={styles.patientMeta}>
                {detail.subPatient ? `Family of ${detail.user.name} · ` : ""}
                {detail.program.name}
                {detail.genotype ? ` · Genotype ${detail.genotype}` : ""}
              </Text>
            </View>
            {detail.adherence?.percent != null ? (
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.adherencePct,
                    {
                      color:
                        detail.adherence.percent >= 70
                          ? colors.teal
                          : detail.adherence.percent >= 40
                            ? colors.warning
                            : colors.error,
                    },
                  ]}
                >
                  {detail.adherence.percent}%
                </Text>
                <Text style={styles.adherenceLabel}>adherence (7d)</Text>
              </View>
            ) : null}
          </View>

          {/* ── Open alerts ── */}
          {openAlerts.map((a) => (
            <View key={a.id} style={styles.alertCard}>
              <View
                style={[
                  styles.sevDot,
                  {
                    backgroundColor:
                      a.severity === "CRITICAL" ? colors.error : colors.warning,
                  },
                ]}
              />
              <Text style={styles.alertMsg} numberOfLines={2}>
                {a.message}
              </Text>
              <AnimatedPressable
                haptic="medium"
                onPress={() => ack(a.id)}
                style={styles.ackBtn}
              >
                {busy === a.id ? (
                  <ActivityIndicator size="small" color={colors.navy} />
                ) : (
                  <Text style={styles.ackText}>Ack</Text>
                )}
              </AnimatedPressable>
            </View>
          ))}

          {/* ── Crisis risk (SCD Phase 4) ── */}
          {detail.risk ? (
            <View style={styles.riskCard}>
              <View style={styles.riskHead}>
                <Text style={styles.riskTitle}>Crisis risk today</Text>
                <Text
                  style={[
                    styles.riskScore,
                    {
                      color:
                        detail.risk.level === "LOW"
                          ? colors.teal
                          : detail.risk.level === "MODERATE"
                            ? colors.warning
                            : colors.error,
                    },
                  ]}
                >
                  {detail.risk.level} · {detail.risk.score}/100
                </Text>
              </View>
              {detail.risk.factors.length === 0 ? (
                <Text style={styles.riskFactorText}>
                  No active risk factors.
                </Text>
              ) : (
                detail.risk.factors.map((f) => (
                  <Text key={f.key} style={styles.riskFactorText}>
                    • {f.label} (+{f.points})
                  </Text>
                ))
              )}
            </View>
          ) : null}

          {/* ── Suggested target tuning (baseline learner, SCD Phase 3) ── */}
          {Object.entries(detail.suggestedThresholds ?? {}).map(([type, s]) => (
            <View key={type} style={styles.suggestCard}>
              <View style={styles.suggestHead}>
                <Ionicons name="bulb" size={15} color={colors.warning} />
                <Text style={styles.suggestTitle}>
                  Tune {detail.vitalCatalog[type]?.label ?? type} band
                  {s.min != null ? ` · min → ${s.min}` : ""}
                  {s.max != null ? ` · max → ${s.max}` : ""}
                </Text>
              </View>
              <Text style={styles.suggestBody}>{s.rationale}</Text>
              <AnimatedPressable
                haptic="medium"
                onPress={() => applySuggestion(type, s)}
                style={styles.suggestApply}
              >
                {busy === `suggest:${type}` ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.suggestApplyText}>
                    Apply for this patient
                  </Text>
                )}
              </AnimatedPressable>
            </View>
          ))}

          {/* ── Goals ── */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Goals</Text>
            <AnimatedPressable
              haptic="light"
              onPress={openGoalSheet}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={15} color="#fff" />
              <Text style={styles.addBtnText}>Add goal</Text>
            </AnimatedPressable>
          </View>
          {visibleGoals.length === 0 ? (
            <Text style={styles.empty}>
              No goals yet — set a measurable target to focus this patient's
              care.
            </Text>
          ) : (
            visibleGoals.map((g) => (
              <View key={g.id} style={styles.goalCard}>
                <View style={styles.goalTop}>
                  <Text style={styles.goalTitle} numberOfLines={2}>
                    {g.title}
                  </Text>
                  {g.status === "ACHIEVED" ? (
                    <Text style={[styles.goalStatus, { color: colors.teal }]}>
                      Achieved
                    </Text>
                  ) : g.status === "MISSED" ? (
                    <Text
                      style={[styles.goalStatus, { color: colors.warning }]}
                    >
                      Missed
                    </Text>
                  ) : (
                    <AnimatedPressable
                      haptic="light"
                      onPress={() => cancelGoal(g.id)}
                    >
                      {busy === g.id ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.text.tertiary}
                        />
                      ) : (
                        <Ionicons
                          name="close-circle-outline"
                          size={19}
                          color={colors.text.tertiary}
                        />
                      )}
                    </AnimatedPressable>
                  )}
                </View>
                <View style={styles.goalTrack}>
                  <View
                    style={[
                      styles.goalFill,
                      {
                        width: `${Math.max(3, g.progress ?? 0)}%`,
                        backgroundColor:
                          g.status === "ACHIEVED"
                            ? colors.teal
                            : g.status === "MISSED"
                              ? colors.warning
                              : colors.navyMid,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}

          {/* ── Vitals trends + targets ── */}
          <Text
            style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}
          >
            Vitals
          </Text>
          {detail.vitals.map((cfg) => {
            const meta = detail.vitalCatalog[cfg.type];
            const series = (detail.readingsByType[cfg.type] ?? []).slice(-14);
            const latest = series.at(-1);
            const maxV = Math.max(...series.map((p) => p.value), 1);
            return (
              <View key={cfg.type} style={styles.vitalCard}>
                <View style={styles.vitalHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vitalName}>
                      {meta?.label ?? cfg.type}
                    </Text>
                    <Text style={styles.vitalTarget}>
                      {cfg.max != null
                        ? `Target ≤ ${cfg.max}${cfg.max2 != null ? `/${cfg.max2}` : ""} ${meta?.unit ?? ""}`
                        : cfg.min != null
                          ? `Target ≥ ${cfg.min} ${meta?.unit ?? ""}`
                          : "No target set"}
                    </Text>
                  </View>
                  {latest ? (
                    <Text style={styles.vitalLatest}>
                      {fmt(cfg.type, latest)}
                    </Text>
                  ) : null}
                  <AnimatedPressable
                    haptic="light"
                    onPress={() => openThreshSheet(cfg)}
                    style={styles.editBtn}
                  >
                    <Ionicons
                      name="options-outline"
                      size={16}
                      color={colors.navyMid}
                    />
                  </AnimatedPressable>
                </View>
                {series.length > 1 ? (
                  <View style={styles.chartBars}>
                    {series.map((p, i) => {
                      const inRange =
                        (cfg.min == null || p.value >= cfg.min) &&
                        (cfg.max == null || p.value <= cfg.max);
                      return (
                        <View key={i} style={styles.barCol}>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.bar,
                                {
                                  height: 6 + (p.value / maxV) * 46,
                                  backgroundColor: inRange
                                    ? colors.teal
                                    : colors.error,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.empty}>Not enough readings to chart</Text>
                )}
              </View>
            );
          })}

          {/* ── Hydroxyurea titration (SCD Phase 5) ── */}
          {detail.vitals.some((v) => v.type === "PAIN") && titration ? (
            <>
              <View style={[styles.sectionHead, { marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>Hydroxyurea</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <AnimatedPressable
                    haptic="light"
                    onPress={() => setLabOpen(true)}
                    style={styles.addBtn}
                  >
                    <Ionicons name="water" size={13} color="#fff" />
                    <Text style={styles.addBtnText}>Record labs</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    haptic="light"
                    onPress={openDoseSheet}
                    style={styles.addBtn}
                  >
                    <Ionicons name="medkit" size={13} color="#fff" />
                    <Text style={styles.addBtnText}>
                      {titration.currentDose ? "Change dose" : "Start"}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>

              {titration.currentDose ? (
                <Text style={styles.doseLine}>
                  {titration.currentDose.doseMgPerDay} mg/day
                  {titration.mgPerKg != null
                    ? ` (${titration.mgPerKg} mg/kg)`
                    : ""}
                  {titration.maxDailyMg != null
                    ? ` · MTD ceiling ${titration.maxDailyMg} mg`
                    : ""}
                  {" · since "}
                  {new Date(titration.currentDose.startedAt).toLocaleDateString(
                    "en-NG",
                    {
                      day: "numeric",
                      month: "short",
                    },
                  )}
                </Text>
              ) : (
                <Text style={styles.empty}>
                  Not tracking hydroxyurea yet — set the starting dose to begin
                  CBC monitoring and titration support.
                </Text>
              )}

              {titration.flags.map((f) => (
                <View
                  key={f.key}
                  style={[
                    styles.flagCard,
                    {
                      borderColor:
                        f.severity === "CRITICAL"
                          ? colors.error
                          : colors.warning,
                    },
                  ]}
                >
                  <Ionicons
                    name="warning"
                    size={14}
                    color={
                      f.severity === "CRITICAL" ? colors.error : colors.warning
                    }
                  />
                  <Text style={styles.flagText}>{f.label}</Text>
                </View>
              ))}
              {titration.dueReasons.map((r, i) => (
                <View key={i} style={styles.dueCard}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={colors.navyMid}
                  />
                  <Text style={styles.dueText}>{r}</Text>
                </View>
              ))}

              {titration.labs.slice(0, 5).map((l) => (
                <View key={l.id} style={styles.labRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labVals}>{labLine(l)}</Text>
                    <Text style={styles.labMeta}>
                      {new Date(l.takenAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {l.source === "DOCTOR"
                        ? "entered by you"
                        : "patient-entered"}
                    </Text>
                  </View>
                  {(l.flags ?? []).length ? (
                    <Ionicons
                      name="alert-circle"
                      size={16}
                      color={
                        (l.flags ?? []).some((f) => f.severity === "CRITICAL")
                          ? colors.error
                          : colors.warning
                      }
                    />
                  ) : null}
                </View>
              ))}

              {titration.doseHistory.length > 1 ? (
                <Text style={styles.doseResponse}>
                  Dose response:{" "}
                  {titration.doseHistory
                    .slice(0, 3)
                    .map(
                      (d) =>
                        `${d.doseMgPerDay} mg → ${d.crisesDuring} crisis${d.crisesDuring === 1 ? "" : "es"}${d.avgHbDuring != null ? `, avg Hb ${d.avgHbDuring}` : ""}`,
                    )
                    .join("  ·  ")}
                </Text>
              ) : null}
            </>
          ) : null}

          {/* ── Crisis history (SCD Phase 3) ── */}
          {(detail.crises ?? []).length > 0 || detail.crisisStats?.count90d ? (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { marginTop: 20, marginBottom: 10 },
                ]}
              >
                Crisis history
              </Text>
              {detail.crisisStats && detail.crisisStats.count90d > 0 ? (
                <Text style={styles.crisisStats}>
                  {detail.crisisStats.count90d} in 90 days
                  {detail.crisisStats.hospitalizations90d > 0
                    ? ` · ${detail.crisisStats.hospitalizations90d} hospitalized`
                    : ""}
                  {detail.crisisStats.avgPain != null
                    ? ` · avg pain ${detail.crisisStats.avgPain}/10`
                    : ""}
                  {detail.crisisStats.avgDurationHours != null
                    ? ` · avg ${detail.crisisStats.avgDurationHours}h long`
                    : ""}
                  {detail.crisisStats.topTriggers.length
                    ? `\nTop triggers: ${detail.crisisStats.topTriggers
                        .map((t) => `${t.trigger} (${t.count})`)
                        .join(", ")}`
                    : ""}
                </Text>
              ) : null}
              {(detail.crises ?? []).map((cr) => (
                <View key={cr.id} style={styles.crisisRow}>
                  <View
                    style={[
                      styles.sevDot,
                      {
                        backgroundColor:
                          cr.painScore >= 7 || cr.hospitalized
                            ? colors.error
                            : colors.warning,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertMsg}>
                      Pain {cr.painScore}/10
                      {cr.hospitalized ? " · hospitalized" : ""}
                      {!cr.resolvedAt ? " · ONGOING" : ""}
                    </Text>
                    <Text style={styles.crisisMeta}>
                      {new Date(cr.startedAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                      {(cr.triggers ?? []).length
                        ? ` · ${(cr.triggers ?? []).join(", ")}`
                        : ""}
                      {(cr.sites ?? []).length
                        ? ` · ${(cr.sites ?? []).join(", ")}`
                        : ""}
                      {cr.treatment ? ` · helped: ${cr.treatment}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* ── Add goal sheet ── */}
      <Modal
        visible={goalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGoalOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 14 }}>
              New goal
            </Txt>

            <Text style={styles.fieldLabel}>Vital</Text>
            <View style={styles.chipRow}>
              {(detail?.vitals ?? []).map((cfg) => (
                <AnimatedPressable
                  key={cfg.type}
                  haptic="light"
                  onPress={() => setGoalType(cfg.type)}
                  style={[styles.chip, goalType === cfg.type && styles.chipSel]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      goalType === cfg.type && { color: "#fff" },
                    ]}
                  >
                    {detail?.vitalCatalog[cfg.type]?.label ?? cfg.type}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Direction</Text>
            <View style={styles.chipRow}>
              {(
                [
                  { v: "AT_OR_BELOW", label: "At or below ≤" },
                  { v: "AT_OR_ABOVE", label: "At or above ≥" },
                ] as const
              ).map((o) => (
                <AnimatedPressable
                  key={o.v}
                  haptic="light"
                  onPress={() => setDirection(o.v)}
                  style={[styles.chip, direction === o.v && styles.chipSel]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      direction === o.v && { color: "#fff" },
                    ]}
                  >
                    {o.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              Target {goalMeta ? `(${goalMeta.unit})` : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={goalMeta?.hasSecond ? "Systolic" : "Target value"}
                placeholderTextColor={colors.text.tertiary}
                value={target}
                onChangeText={setTarget}
                keyboardType="decimal-pad"
              />
              {goalMeta?.hasSecond ? (
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Diastolic"
                  placeholderTextColor={colors.text.tertiary}
                  value={target2}
                  onChangeText={setTarget2}
                  keyboardType="decimal-pad"
                />
              ) : null}
            </View>

            <Text style={styles.fieldLabel}>Due</Text>
            <View style={styles.chipRow}>
              {[
                { v: 30, label: "30 days" },
                { v: 60, label: "60 days" },
                { v: 90, label: "90 days" },
                { v: null, label: "Open-ended" },
              ].map((o) => (
                <AnimatedPressable
                  key={o.label}
                  haptic="light"
                  onPress={() => setDueDays(o.v)}
                  style={[styles.chip, dueDays === o.v && styles.chipSel]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      dueDays === o.v && { color: "#fff" },
                    ]}
                  >
                    {o.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Button
                label="Cancel"
                onPress={() => setGoalOpen(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Set goal"
                onPress={submitGoal}
                loading={busy === "goal"}
                disabled={!goalType || !Number.isFinite(parseFloat(target))}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit thresholds sheet ── */}
      <Modal
        visible={!!threshType}
        animationType="slide"
        transparent
        onRequestClose={() => setThreshType(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 4 }}>
              {threshMeta?.label} targets
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginBottom: 16 }}
            >
              Personal target range for this patient — readings outside it raise
              an alert.
            </Txt>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min"
                placeholderTextColor={colors.text.tertiary}
                value={tMin}
                onChangeText={setTMin}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={threshMeta?.hasSecond ? "Max (systolic)" : "Max"}
                placeholderTextColor={colors.text.tertiary}
                value={tMax}
                onChangeText={setTMax}
                keyboardType="decimal-pad"
              />
              {threshMeta?.hasSecond ? (
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Max (dia)"
                  placeholderTextColor={colors.text.tertiary}
                  value={tMax2}
                  onChangeText={setTMax2}
                  keyboardType="decimal-pad"
                />
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
              <Button
                label="Cancel"
                onPress={() => setThreshType(null)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Save targets"
                onPress={submitThresholds}
                loading={busy === "thresh"}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Set dose sheet (SCD Phase 5) ── */}
      <Modal
        visible={doseOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDoseOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 4 }}>
              Hydroxyurea dose
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginBottom: 16 }}
            >
              Total daily dose. Weight enables mg/kg and the 35 mg/kg MTD
              ceiling. The patient is notified of the change.
            </Txt>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="mg per day"
                placeholderTextColor={colors.text.tertiary}
                value={doseMg}
                onChangeText={setDoseMg}
                keyboardType="number-pad"
                autoFocus
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Weight (kg)"
                placeholderTextColor={colors.text.tertiary}
                value={doseWeight}
                onChangeText={setDoseWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <TextInput
              style={[styles.input, { height: 48, fontSize: 14 }]}
              placeholder="Note, e.g. titration step 2 (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={doseNote}
              onChangeText={setDoseNote}
              maxLength={300}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
              <Button
                label="Cancel"
                onPress={() => setDoseOpen(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Save dose"
                onPress={submitDose}
                loading={busy === "dose"}
                disabled={!Number.isFinite(parseInt(doseMg, 10))}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Record labs sheet (SCD Phase 5) ── */}
      <Modal
        visible={labOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLabOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 4 }}>
              Record CBC results
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginBottom: 16 }}
            >
              Enter what's on the report — any subset is fine. Safety flags are
              checked automatically.
            </Txt>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Hb (g/dL)"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.hb ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, hb: v }))}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="WBC"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.wbc ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, wbc: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="ANC"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.anc ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, anc: v }))}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Platelets"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.platelets ?? ""}
                onChangeText={(v) =>
                  setLabVals((s) => ({ ...s, platelets: v }))
                }
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="MCV"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.mcv ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, mcv: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
              <Button
                label="Cancel"
                onPress={() => setLabOpen(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Save results"
                onPress={submitLab}
                loading={busy === "lab"}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: Space.xl, paddingBottom: 40 },

    headCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    patientName: { ...Type.h3, color: c.text.primary },
    patientMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    adherencePct: {
      fontFamily: Fonts.extrabold,
      fontSize: 22,
      letterSpacing: -0.5,
    },
    adherenceLabel: {
      ...Type.caption,
      fontSize: 10,
      color: c.text.tertiary,
    },

    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 12,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    sevDot: { width: 9, height: 9, borderRadius: 5 },
    alertMsg: { ...Type.caption, color: c.text.primary, flex: 1 },
    ackBtn: {
      backgroundColor: c.navySoft,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.round,
      minWidth: 48,
      alignItems: "center",
    },
    ackText: { fontFamily: Fonts.bold, fontSize: 12, color: c.navy },

    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      marginBottom: 10,
    },
    sectionTitle: { ...Type.h2, color: c.text.primary },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.teal,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: Radius.round,
    },
    addBtnText: { fontFamily: Fonts.bold, fontSize: 12.5, color: "#fff" },
    empty: { ...Type.caption, color: c.text.tertiary, marginBottom: 8 },

    goalCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 13,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    goalTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 9,
    },
    goalTitle: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
      flex: 1,
    },
    goalStatus: { fontFamily: Fonts.bold, fontSize: 12 },
    goalTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: c.background,
      overflow: "hidden",
    },
    goalFill: { height: "100%", borderRadius: 4 },

    vitalCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    vitalHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    vitalName: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    vitalTarget: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    vitalLatest: {
      fontFamily: Fonts.extrabold,
      fontSize: 16,
      color: c.text.primary,
    },
    editBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    chartBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 3,
      marginTop: 12,
    },
    barCol: { flex: 1, alignItems: "center" },
    barTrack: {
      height: 54,
      justifyContent: "flex-end",
      alignItems: "center",
      width: "100%",
    },
    bar: { width: "68%", maxWidth: 16, borderRadius: 4, minHeight: 6 },

    overlay: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      padding: Space.xxl,
      paddingBottom: 40,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginBottom: 18,
    },
    fieldLabel: { ...Type.label, color: c.text.secondary, marginBottom: 8 },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: Radius.round,
    },
    chipSel: { backgroundColor: c.navy, borderColor: "transparent" },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 12.5,
      color: c.text.secondary,
    },
    input: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      height: 52,
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: c.text.primary,
      marginBottom: 12,
    },

    // SCD Phase 3: baseline-learner suggestions + crisis history
    suggestCard: {
      backgroundColor: c.tealSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 14,
      marginBottom: 12,
    },
    suggestHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: 6,
    },
    suggestTitle: {
      fontFamily: Fonts.bold,
      fontSize: 13.5,
      color: c.text.primary,
      flex: 1,
    },
    suggestBody: {
      ...Type.caption,
      color: c.text.secondary,
      lineHeight: 17,
      marginBottom: 10,
    },
    suggestApply: {
      alignSelf: "flex-start",
      backgroundColor: c.navy,
      borderRadius: Radius.round,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    suggestApplyText: { fontFamily: Fonts.bold, fontSize: 12.5, color: "#fff" },
    crisisStats: {
      ...Type.caption,
      color: c.text.secondary,
      lineHeight: 18,
      marginBottom: 10,
      marginLeft: 2,
    },
    crisisRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 12,
      marginBottom: 8,
    },
    crisisMeta: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 3,
      lineHeight: 16,
    },
    riskCard: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 14,
      marginBottom: 12,
    },
    riskHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    riskTitle: { fontFamily: Fonts.bold, fontSize: 14, color: c.text.primary },
    riskScore: { fontFamily: Fonts.bold, fontSize: 13 },
    riskFactorText: {
      ...Type.caption,
      color: c.text.secondary,
      lineHeight: 18,
      marginBottom: 3,
    },

    // Titration (SCD Phase 5)
    doseLine: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
      marginBottom: 10,
      marginLeft: 2,
    },
    flagCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: 12,
      marginBottom: 8,
    },
    flagText: {
      ...Type.caption,
      color: c.text.primary,
      flex: 1,
      lineHeight: 17,
    },
    dueCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: c.tealSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 12,
      marginBottom: 8,
    },
    dueText: {
      ...Type.caption,
      color: c.text.secondary,
      flex: 1,
      lineHeight: 17,
    },
    labRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 12,
      marginBottom: 8,
    },
    labVals: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.primary,
    },
    labMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    doseResponse: {
      ...Type.caption,
      color: c.text.secondary,
      lineHeight: 18,
      marginTop: 4,
      marginBottom: 8,
      marginLeft: 2,
    },
  });
