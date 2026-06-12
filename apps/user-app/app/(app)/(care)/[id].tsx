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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { careApi } from "../../../src/api/care.api";

interface VitalMeta {
  label: string;
  unit: string;
  hasSecond: boolean;
}
interface VitalConfig {
  type: string;
  min?: number;
  max?: number;
  min2?: number;
  max2?: number;
  cadencePerWeek?: number;
}
interface ReadingPoint {
  value: number;
  value2: number | null;
  takenAt: string;
}
interface AlertRow {
  id: string;
  type: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  acknowledgedAt: string | null;
  createdAt: string;
}
interface Goal {
  id: string;
  type: string;
  title: string;
  status: "ACTIVE" | "ACHIEVED" | "MISSED" | "CANCELLED";
  dueDate: string | null;
  progress: number | null;
}
interface Adherence {
  expectedPerWeek: number;
  readings7d: number;
  percent: number | null;
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
interface Risk {
  score: number;
  level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factors: { key: string; label: string; points: number }[];
}
interface Lab {
  id: string;
  hb: number | null;
  wbc: number | null;
  anc: number | null;
  platelets: number | null;
  mcv: number | null;
  flags: { severity: string }[];
  takenAt: string;
}
interface Titration {
  currentDose: { doseMgPerDay: number; startedAt: string } | null;
  labs: Lab[];
}
interface Detail {
  id: string;
  status: string;
  program: { name: string; condition: string; description: string };
  doctor: { name: string; image: string; designation: string } | null;
  subPatient: { id: string; name: string } | null;
  sponsorship: { organization: { name: string } } | null;
  vitals: VitalConfig[];
  vitalCatalog: Record<string, VitalMeta>;
  readingsByType: Record<string, ReadingPoint[]>;
  alerts: AlertRow[];
  goals: Goal[];
  adherence: Adherence | null;
  crises?: Crisis[];
  crisisStats?: CrisisStats;
  risk?: Risk | null;
}

const RISK_META: Record<Risk["level"], { label: string; tip: string }> = {
  LOW: { label: "Low", tip: "Keep doing what you're doing." },
  MODERATE: {
    label: "Moderate",
    tip: "Stay on top of water, warmth and your medications today.",
  },
  HIGH: {
    label: "High",
    tip: "Drink water steadily, rest and keep warm. Your care lead can see this too.",
  },
  CRITICAL: {
    label: "Very high",
    tip: "Take extra care today. If pain starts, or you have chest pain or trouble breathing, seek care immediately.",
  },
};

const CRISIS_SITES = [
  "Chest",
  "Back",
  "Arms",
  "Legs",
  "Joints",
  "Abdomen",
  "Head",
];
const CRISIS_TRIGGERS = [
  "Dehydration",
  "Infection/fever",
  "Cold weather",
  "Stress",
  "Overexertion",
  "Missed medication",
  "Poor sleep",
  "Unknown",
];
type Banner = { status: "OK" | "WARNING" | "CRITICAL"; message: string };

const makeBannerStyle = (c: Palette) => ({
  OK: {
    bg: "rgba(44,183,167,0.12)",
    color: c.teal,
    icon: "checkmark-circle" as const,
  },
  WARNING: {
    bg: "rgba(247,144,9,0.12)",
    color: c.warning,
    icon: "alert-circle" as const,
  },
  CRITICAL: {
    bg: "rgba(240,103,92,0.12)",
    color: c.error,
    icon: "warning" as const,
  },
});

export default function EnrollmentScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const BANNER_STYLE = makeBannerStyle(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner | null>(null);

  // Log sheet
  const [logType, setLogType] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [titration, setTitration] = useState<Titration | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    careApi
      .getEnrollment(id)
      .then((r: unknown) => setDetail((r as { data: Detail }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
    careApi
      .getTitration(id)
      .then((r: unknown) => setTitration((r as { data: Titration }).data))
      .catch(() => setTitration(null));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openLog = (type: string) => {
    setLogType(type);
    setValue("");
    setValue2("");
    setNote("");
  };

  const submit = async () => {
    if (!id || !logType) return;
    const v = parseFloat(value);
    if (!Number.isFinite(v)) return;
    const meta = detail?.vitalCatalog[logType];
    const v2 = meta?.hasSecond ? parseFloat(value2) : undefined;
    if (meta?.hasSecond && !Number.isFinite(v2)) return;
    setSaving(true);
    try {
      const r: unknown = await careApi.logReading(id, {
        type: logType,
        value: v,
        value2: v2,
        note: note.trim() || undefined,
      });
      const d = (r as { data: Banner }).data;
      setBanner({ status: d.status, message: d.message });
      setLogType(null);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  // ── Crisis diary (SCD Phase 3) ──
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [painScore, setPainScore] = useState<number | null>(null);
  const [sites, setSites] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [treatment, setTreatment] = useState("");
  const [hospitalized, setHospitalized] = useState(false);
  const [ongoing, setOngoing] = useState(true);
  const [crisisSaving, setCrisisSaving] = useState(false);

  const tracksPain = !!detail?.vitals.some((v) => v.type === "PAIN");

  const openCrisis = () => {
    setPainScore(null);
    setSites([]);
    setTriggers([]);
    setTreatment("");
    setHospitalized(false);
    setOngoing(true);
    setCrisisOpen(true);
  };

  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const submitCrisis = async () => {
    if (!id || painScore == null) return;
    setCrisisSaving(true);
    try {
      const r: unknown = await careApi.logCrisis(id, {
        painScore,
        sites,
        triggers,
        treatment: treatment.trim() || undefined,
        hospitalized,
        resolvedAt: ongoing ? undefined : new Date().toISOString(),
      });
      const sev = (r as { data: { severity?: string } }).data?.severity;
      setCrisisOpen(false);
      setBanner({
        status: sev === "CRITICAL" ? "CRITICAL" : "WARNING",
        message:
          sev === "CRITICAL"
            ? "Crisis logged — your care lead has been alerted. If your pain is severe, or you have chest pain or trouble breathing, seek urgent care now."
            : "Crisis logged — your care lead has been notified. Take care of yourself.",
      });
      load();
    } catch {
    } finally {
      setCrisisSaving(false);
    }
  };

  // ── Labs (SCD Phase 5) ──
  const [labOpen, setLabOpen] = useState(false);
  const [labVals, setLabVals] = useState<Record<string, string>>({});
  const [labSaving, setLabSaving] = useState(false);

  const submitLab = async () => {
    if (!id) return;
    const payload: Record<string, number> = {};
    for (const k of ["hb", "wbc", "anc", "platelets", "mcv"]) {
      const v = parseFloat(labVals[k] ?? "");
      if (Number.isFinite(v)) payload[k] = v;
    }
    if (!Object.keys(payload).length) return;
    setLabSaving(true);
    try {
      const r: unknown = await careApi.recordLab(id, payload);
      const flagged =
        ((r as { data: { flags?: unknown[] } }).data?.flags ?? []).length > 0;
      setLabOpen(false);
      setLabVals({});
      setBanner({
        status: flagged ? "WARNING" : "OK",
        message: flagged
          ? "Results saved — some values need your doctor's attention, and your care lead has been alerted. Don't change your medication dose yourself."
          : "Lab results saved and shared with your care lead.",
      });
      load();
    } catch (e) {
      Alert.alert(
        "Couldn't save results",
        (e as { message?: string })?.message ?? "Please try again.",
      );
    } finally {
      setLabSaving(false);
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

  const markCrisisOver = (crisisId: string) => {
    Alert.alert("Glad it's over", "Mark this crisis as resolved?", [
      { text: "Not yet", style: "cancel" },
      {
        text: "It's over",
        onPress: async () => {
          try {
            await careApi.resolveCrisis(crisisId);
            load();
          } catch {}
        },
      },
    ]);
  };

  const withdraw = () => {
    Alert.alert(
      "Leave program",
      "You can re-join any time. Your readings stay in your records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            try {
              await careApi.withdraw(id);
              router.back();
            } catch {}
          },
        },
      ],
    );
  };

  const fmt = (type: string, p: { value: number; value2: number | null }) => {
    const meta = detail?.vitalCatalog[type];
    const v =
      meta?.hasSecond && p.value2 != null
        ? `${p.value}/${p.value2}`
        : `${p.value}`;
    return `${v} ${meta?.unit ?? ""}`.trim();
  };

  const targetLine = (cfg: VitalConfig) => {
    const meta = detail?.vitalCatalog[cfg.type];
    if (cfg.min != null && cfg.max != null)
      return `Target ${cfg.min}–${cfg.max}${meta?.hasSecond && cfg.max2 != null ? `/${cfg.max2}` : ""} ${meta?.unit ?? ""}`;
    if (cfg.max != null) return `Target ≤ ${cfg.max} ${meta?.unit ?? ""}`;
    if (cfg.min != null) return `Target ≥ ${cfg.min} ${meta?.unit ?? ""}`;
    return "Tracked for your records";
  };

  const logMeta = logType ? detail?.vitalCatalog[logType] : null;

  return (
    <View style={styles.root}>
      <AppHeader title={detail?.program.name ?? "Care program"} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : !detail ? null : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {banner ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: BANNER_STYLE[banner.status].bg },
              ]}
            >
              <Ionicons
                name={BANNER_STYLE[banner.status].icon}
                size={18}
                color={BANNER_STYLE[banner.status].color}
              />
              <Text style={styles.bannerText}>{banner.message}</Text>
              <AnimatedPressable haptic="light" onPress={() => setBanner(null)}>
                <Ionicons name="close" size={16} color={colors.text.tertiary} />
              </AnimatedPressable>
            </View>
          ) : null}

          {detail.subPatient || detail.doctor || detail.sponsorship ? (
            <View style={styles.leadRow}>
              <Ionicons name="medkit" size={14} color={colors.navyMid} />
              <Text style={styles.leadText}>
                {[
                  detail.subPatient ? `For ${detail.subPatient.name}` : null,
                  detail.sponsorship
                    ? `Sponsored by ${detail.sponsorship.organization.name}`
                    : null,
                  detail.doctor
                    ? `Care lead · Dr. ${detail.doctor.name}${detail.doctor.designation ? ` (${detail.doctor.designation})` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          ) : null}

          {detail.adherence && detail.adherence.expectedPerWeek > 0 ? (
            <View style={styles.adherenceCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adherenceTitle}>This week</Text>
                <Text style={styles.adherenceSub}>
                  {detail.adherence.readings7d} of{" "}
                  {detail.adherence.expectedPerWeek} expected readings logged
                </Text>
              </View>
              <Text
                style={[
                  styles.adherencePct,
                  {
                    color:
                      (detail.adherence.percent ?? 0) >= 70
                        ? colors.teal
                        : (detail.adherence.percent ?? 0) >= 40
                          ? colors.warning
                          : colors.error,
                  },
                ]}
              >
                {detail.adherence.percent ?? 0}%
              </Text>
            </View>
          ) : null}

          {/* ── Crisis risk today (SCD Phase 4) ── */}
          {detail.risk ? (
            <View style={styles.riskCard}>
              <View style={styles.riskHead}>
                <Text style={styles.riskTitle}>Crisis risk today</Text>
                <View
                  style={[
                    styles.riskPill,
                    {
                      backgroundColor:
                        detail.risk.level === "LOW"
                          ? "rgba(44,183,167,0.14)"
                          : detail.risk.level === "MODERATE"
                            ? "rgba(247,144,9,0.14)"
                            : "rgba(240,103,92,0.16)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.riskPillText,
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
                    {RISK_META[detail.risk.level].label} · {detail.risk.score}
                    /100
                  </Text>
                </View>
              </View>
              {detail.risk.factors.map((f) => (
                <View key={f.key} style={styles.riskFactor}>
                  <Ionicons
                    name="ellipse"
                    size={6}
                    color={colors.text.tertiary}
                    style={{ marginTop: 6 }}
                  />
                  <Text style={styles.riskFactorText}>{f.label}</Text>
                </View>
              ))}
              <Text style={styles.riskTip}>
                {RISK_META[detail.risk.level].tip}
              </Text>
            </View>
          ) : null}

          {/* ── Goals ── */}
          {detail.goals.filter((g) => g.status !== "CANCELLED").length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>My goals</Text>
              {detail.goals
                .filter((g) => g.status !== "CANCELLED")
                .map((g) => (
                  <View key={g.id} style={styles.goalCard}>
                    <View style={styles.goalTop}>
                      <Text style={styles.goalTitle} numberOfLines={2}>
                        {g.title}
                      </Text>
                      {g.status === "ACHIEVED" ? (
                        <View
                          style={[
                            styles.goalChip,
                            { backgroundColor: "rgba(44,183,167,0.12)" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.goalChipText,
                              { color: colors.teal },
                            ]}
                          >
                            Achieved 🎉
                          </Text>
                        </View>
                      ) : g.status === "MISSED" ? (
                        <View
                          style={[
                            styles.goalChip,
                            { backgroundColor: "rgba(247,144,9,0.12)" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.goalChipText,
                              { color: colors.warning },
                            ]}
                          >
                            Missed
                          </Text>
                        </View>
                      ) : g.dueDate ? (
                        <Text style={styles.goalDue}>
                          by{" "}
                          {new Date(g.dueDate).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Text>
                      ) : null}
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
                    <Text style={styles.goalPct}>
                      {g.progress != null
                        ? `${g.progress}% there`
                        : "Log a reading to start tracking"}
                    </Text>
                  </View>
                ))}
            </>
          ) : null}

          {/* ── Tracked vitals ── */}
          {detail.vitals.map((cfg) => {
            const meta = detail.vitalCatalog[cfg.type];
            const series = detail.readingsByType[cfg.type] ?? [];
            const recent = series.slice(-14);
            const latest = series.at(-1);
            const maxV = Math.max(...recent.map((p) => p.value), 1);
            return (
              <View key={cfg.type} style={styles.vitalCard}>
                <View style={styles.vitalHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vitalName}>
                      {meta?.label ?? cfg.type}
                    </Text>
                    <Text style={styles.vitalTarget}>{targetLine(cfg)}</Text>
                  </View>
                  <AnimatedPressable
                    haptic="medium"
                    onPress={() => openLog(cfg.type)}
                    style={styles.logBtn}
                  >
                    <Ionicons name="add" size={15} color="#fff" />
                    <Text style={styles.logBtnText}>Log</Text>
                  </AnimatedPressable>
                </View>

                {latest ? (
                  <Text style={styles.latest}>
                    {fmt(cfg.type, latest)}
                    <Text style={styles.latestAt}>
                      {"  "}·{" "}
                      {new Date(latest.takenAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.noData}>No readings yet</Text>
                )}

                {recent.length > 1 ? (
                  <View style={styles.chartBars}>
                    {recent.map((p, i) => {
                      const inRange =
                        (cfg.min == null || p.value >= cfg.min) &&
                        (cfg.max == null || p.value <= cfg.max) &&
                        (p.value2 == null ||
                          ((cfg.min2 == null || p.value2 >= cfg.min2) &&
                            (cfg.max2 == null || p.value2 <= cfg.max2)));
                      return (
                        <View key={i} style={styles.barCol}>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.bar,
                                {
                                  height: 6 + (p.value / maxV) * 52,
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
                ) : null}
              </View>
            );
          })}

          {/* ── Crisis diary (SCD Phase 3) ── */}
          {tracksPain ? (
            <>
              <View style={styles.crisisHead}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  Crisis diary
                </Text>
                <AnimatedPressable
                  haptic="medium"
                  onPress={openCrisis}
                  style={styles.crisisBtn}
                >
                  <Ionicons name="flame" size={13} color="#fff" />
                  <Text style={styles.crisisBtnText}>Log crisis</Text>
                </AnimatedPressable>
              </View>
              {detail.crisisStats && detail.crisisStats.count90d > 0 ? (
                <Text style={styles.crisisSummary}>
                  {detail.crisisStats.count90d} in the last 90 days
                  {detail.crisisStats.hospitalizations90d > 0
                    ? ` · ${detail.crisisStats.hospitalizations90d} hospital visit${detail.crisisStats.hospitalizations90d === 1 ? "" : "s"}`
                    : ""}
                  {detail.crisisStats.topTriggers[0]
                    ? ` · top trigger: ${detail.crisisStats.topTriggers[0].trigger}`
                    : ""}
                </Text>
              ) : null}
              {(detail.crises ?? []).length === 0 ? (
                <Text style={styles.crisisEmpty}>
                  No crises logged. If one happens, log it here — your trigger
                  history helps your care lead personalize your plan.
                </Text>
              ) : (
                (detail.crises ?? []).slice(0, 5).map((cr) => (
                  <View key={cr.id} style={styles.alertRow}>
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
                        {!cr.resolvedAt ? " · ongoing" : ""}
                      </Text>
                      <Text style={styles.alertMeta}>
                        {new Date(cr.startedAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                        })}
                        {(cr.triggers ?? []).length
                          ? ` · ${(cr.triggers ?? []).join(", ")}`
                          : ""}
                      </Text>
                    </View>
                    {!cr.resolvedAt ? (
                      <AnimatedPressable
                        haptic="light"
                        onPress={() => markCrisisOver(cr.id)}
                        style={styles.resolveBtn}
                      >
                        <Text style={styles.resolveBtnText}>It's over</Text>
                      </AnimatedPressable>
                    ) : null}
                  </View>
                ))
              )}
            </>
          ) : null}

          {/* ── Labs & medication (SCD Phase 5) ── */}
          {tracksPain && titration ? (
            <>
              <View style={styles.crisisHead}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  Labs & medication
                </Text>
                <AnimatedPressable
                  haptic="medium"
                  onPress={() => setLabOpen(true)}
                  style={styles.labBtn}
                >
                  <Ionicons name="water" size={13} color="#fff" />
                  <Text style={styles.crisisBtnText}>Add lab result</Text>
                </AnimatedPressable>
              </View>
              {titration.currentDose ? (
                <Text style={styles.crisisSummary}>
                  Hydroxyurea {titration.currentDose.doseMgPerDay} mg/day — take
                  it exactly as prescribed.
                </Text>
              ) : null}
              {(titration.labs ?? []).length === 0 ? (
                <Text style={styles.crisisEmpty}>
                  No lab results yet. After your next blood test (CBC), enter
                  the results here so your care lead can monitor your medication
                  safely.
                </Text>
              ) : (
                (titration.labs ?? []).slice(0, 3).map((l) => (
                  <View key={l.id} style={styles.alertRow}>
                    <View
                      style={[
                        styles.sevDot,
                        {
                          backgroundColor: (l.flags ?? []).length
                            ? colors.warning
                            : colors.teal,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertMsg}>{labLine(l)}</Text>
                      <Text style={styles.alertMeta}>
                        {new Date(l.takenAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                        })}
                        {(l.flags ?? []).length
                          ? " · shared with your care lead"
                          : " · within expected range"}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}

          {/* ── Alerts ── */}
          {detail.alerts.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Alerts</Text>
              {detail.alerts.map((a) => (
                <View key={a.id} style={styles.alertRow}>
                  <View
                    style={[
                      styles.sevDot,
                      {
                        backgroundColor:
                          a.severity === "CRITICAL"
                            ? colors.error
                            : colors.warning,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertMsg} numberOfLines={2}>
                      {a.message}
                    </Text>
                    <Text style={styles.alertMeta}>
                      {new Date(a.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      ·{" "}
                      {a.acknowledgedAt
                        ? "Seen by your care lead"
                        : "Awaiting review"}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <AnimatedPressable
            haptic="light"
            onPress={withdraw}
            style={styles.leave}
          >
            <Text style={styles.leaveText}>Leave this program</Text>
          </AnimatedPressable>
        </ScrollView>
      )}

      {/* ── Log sheet ── */}
      <Modal
        visible={!!logType}
        animationType="slide"
        transparent
        onRequestClose={() => setLogType(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 4 }}>
              Log {logMeta?.label.toLowerCase()}
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginBottom: 16 }}
            >
              {logMeta?.hasSecond
                ? "Enter both numbers, e.g. 120 and 80."
                : `Measured in ${logMeta?.unit}.`}
            </Txt>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={
                  logMeta?.hasSecond ? "Systolic" : `Value (${logMeta?.unit})`
                }
                placeholderTextColor={colors.text.tertiary}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                autoFocus
              />
              {logMeta?.hasSecond ? (
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Diastolic"
                  placeholderTextColor={colors.text.tertiary}
                  value={value2}
                  onChangeText={setValue2}
                  keyboardType="decimal-pad"
                />
              ) : null}
            </View>
            <TextInput
              style={[styles.input, { height: 48, fontSize: 14 }]}
              placeholder="Note (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={note}
              onChangeText={setNote}
              maxLength={300}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
              <Button
                label="Cancel"
                onPress={() => setLogType(null)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Save reading"
                onPress={submit}
                loading={saving}
                disabled={
                  !Number.isFinite(parseFloat(value)) ||
                  (!!logMeta?.hasSecond && !Number.isFinite(parseFloat(value2)))
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Crisis sheet (SCD Phase 3) ── */}
      <Modal
        visible={crisisOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCrisisOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: "88%" }]}>
            <View style={styles.handle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Txt variant="h2" style={{ marginBottom: 4 }}>
                Log a crisis
              </Txt>
              <Txt
                variant="body"
                color={colors.text.secondary}
                style={{ marginBottom: 16 }}
              >
                Sorry you're going through this. A quick log alerts your care
                lead and builds your personal trigger picture.
              </Txt>

              <Text style={styles.fieldLabel}>Pain at its worst (0–10)</Text>
              <View style={styles.chipRow}>
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <AnimatedPressable
                    key={n}
                    haptic="light"
                    onPress={() => setPainScore(n)}
                    style={[
                      styles.painChip,
                      painScore === n && styles.painChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        painScore === n && styles.chipTextOn,
                      ]}
                    >
                      {n}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Where does it hurt?</Text>
              <View style={styles.chipRow}>
                {CRISIS_SITES.map((s) => (
                  <AnimatedPressable
                    key={s}
                    haptic="light"
                    onPress={() => setSites((l) => toggleIn(l, s))}
                    style={[styles.chip, sites.includes(s) && styles.chipOn]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        sites.includes(s) && styles.chipTextOn,
                      ]}
                    >
                      {s}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>
                What do you think triggered it?
              </Text>
              <View style={styles.chipRow}>
                {CRISIS_TRIGGERS.map((t) => (
                  <AnimatedPressable
                    key={t}
                    haptic="light"
                    onPress={() => setTriggers((l) => toggleIn(l, t))}
                    style={[styles.chip, triggers.includes(t) && styles.chipOn]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        triggers.includes(t) && styles.chipTextOn,
                      ]}
                    >
                      {t}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>

              <AnimatedPressable
                haptic="light"
                onPress={() => setHospitalized((v) => !v)}
                style={styles.toggleRow}
              >
                <Ionicons
                  name={hospitalized ? "checkbox" : "square-outline"}
                  size={20}
                  color={hospitalized ? colors.teal : colors.text.tertiary}
                />
                <Text style={styles.toggleLabel}>
                  I went to a hospital or clinic
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                haptic="light"
                onPress={() => setOngoing((v) => !v)}
                style={styles.toggleRow}
              >
                <Ionicons
                  name={ongoing ? "checkbox" : "square-outline"}
                  size={20}
                  color={ongoing ? colors.teal : colors.text.tertiary}
                />
                <Text style={styles.toggleLabel}>It's still ongoing</Text>
              </AnimatedPressable>

              <TextInput
                style={[styles.input, { height: 48, fontSize: 14 }]}
                placeholder="What helped? e.g. fluids, painkillers (optional)"
                placeholderTextColor={colors.text.tertiary}
                value={treatment}
                onChangeText={setTreatment}
                maxLength={300}
              />

              <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                <Button
                  label="Cancel"
                  onPress={() => setCrisisOpen(false)}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button
                  label="Log crisis"
                  onPress={submitCrisis}
                  loading={crisisSaving}
                  disabled={painScore == null}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add lab result sheet (SCD Phase 5) ── */}
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
              Add lab result
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginBottom: 16 }}
            >
              Copy the values from your blood test (CBC) report — fill in
              whichever ones you have.
            </Txt>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, fontSize: 15 }]}
                placeholder="Hb (g/dL)"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.hb ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, hb: v }))}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1, fontSize: 15 }]}
                placeholder="WBC"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.wbc ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, wbc: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, fontSize: 15 }]}
                placeholder="ANC"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.anc ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, anc: v }))}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1, fontSize: 15 }]}
                placeholder="Platelets"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.platelets ?? ""}
                onChangeText={(v) =>
                  setLabVals((s) => ({ ...s, platelets: v }))
                }
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1, fontSize: 15 }]}
                placeholder="MCV"
                placeholderTextColor={colors.text.tertiary}
                value={labVals.mcv ?? ""}
                onChangeText={(v) => setLabVals((s) => ({ ...s, mcv: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.labSafetyNote}>
              Never change your medication dose based on results alone — your
              care lead reviews every entry.
            </Text>
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
                loading={labSaving}
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

    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: Radius.lg,
      padding: 14,
      marginBottom: 12,
    },
    bannerText: {
      ...Type.bodySm,
      color: c.text.primary,
      flex: 1,
      lineHeight: 19,
    },
    leadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      paddingLeft: 4,
    },
    leadText: { ...Type.caption, color: c.text.secondary },

    adherenceCard: {
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
    adherenceTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    adherenceSub: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    adherencePct: {
      fontFamily: Fonts.extrabold,
      fontSize: 26,
      letterSpacing: -0.6,
    },

    goalCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    goalTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10,
    },
    goalTitle: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
      flex: 1,
    },
    goalChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    goalChipText: { fontFamily: Fonts.bold, fontSize: 11.5 },
    goalDue: { ...Type.caption, color: c.text.tertiary },
    goalTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.background,
      overflow: "hidden",
    },
    goalFill: { height: "100%", borderRadius: 4 },
    goalPct: { ...Type.caption, color: c.text.tertiary, marginTop: 6 },

    vitalCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    vitalHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    vitalName: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    vitalTarget: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    logBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.teal,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.round,
    },
    logBtnText: { fontFamily: Fonts.bold, fontSize: 13, color: "#fff" },
    latest: {
      fontFamily: Fonts.extrabold,
      fontSize: 24,
      color: c.text.primary,
      letterSpacing: -0.5,
      marginTop: 14,
    },
    latestAt: {
      ...Type.caption,
      fontFamily: Fonts.medium,
      color: c.text.tertiary,
    },
    noData: { ...Type.caption, color: c.text.tertiary, marginTop: 14 },
    chartBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
      marginTop: 12,
    },
    barCol: { flex: 1, alignItems: "center" },
    barTrack: {
      height: 60,
      justifyContent: "flex-end",
      alignItems: "center",
      width: "100%",
    },
    bar: { width: "70%", maxWidth: 18, borderRadius: 5, minHeight: 6 },

    sectionTitle: {
      ...Type.overline,
      color: c.text.tertiary,
      marginTop: 14,
      marginBottom: 10,
      marginLeft: 4,
    },
    alertRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 13,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    sevDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
    alertMsg: { ...Type.bodySm, color: c.text.primary },
    alertMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },

    leave: { alignSelf: "center", marginTop: 18, padding: 8 },
    leaveText: { ...Type.bodySm, fontFamily: Fonts.bold, color: c.error },

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
    input: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      height: 56,
      fontFamily: Fonts.bold,
      fontSize: 18,
      color: c.text.primary,
      marginBottom: 12,
    },

    // Crisis diary (SCD Phase 3)
    crisisHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
      marginBottom: 10,
    },
    crisisBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.error,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.round,
    },
    crisisBtnText: { fontFamily: Fonts.bold, fontSize: 12.5, color: "#fff" },
    crisisSummary: {
      ...Type.caption,
      color: c.text.secondary,
      marginBottom: 10,
      marginLeft: 4,
    },
    crisisEmpty: {
      ...Type.caption,
      color: c.text.tertiary,
      marginBottom: 8,
      marginLeft: 4,
      lineHeight: 17,
    },
    resolveBtn: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.round,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    resolveBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      color: c.text.primary,
    },
    fieldLabel: {
      ...Type.label,
      color: c.text.secondary,
      marginBottom: 8,
      marginTop: 4,
    },
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
      borderRadius: Radius.round,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    chipOn: { backgroundColor: c.navy, borderColor: c.navy },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 12.5,
      color: c.text.primary,
    },
    chipTextOn: { color: "#fff" },
    painChip: {
      width: 38,
      alignItems: "center",
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingVertical: 9,
    },
    painChipOn: { backgroundColor: c.error, borderColor: c.error },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      marginBottom: 4,
    },
    toggleLabel: { ...Type.bodySm, color: c.text.primary },

    // Crisis risk (SCD Phase 4)
    riskCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    riskHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    riskTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    riskPill: {
      borderRadius: Radius.round,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    riskPillText: { fontFamily: Fonts.bold, fontSize: 12 },
    riskFactor: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 6,
    },
    riskFactorText: {
      ...Type.caption,
      color: c.text.secondary,
      flex: 1,
      lineHeight: 17,
    },
    riskTip: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 6,
      lineHeight: 17,
    },

    // Labs (SCD Phase 5)
    labBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.navy,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.round,
    },
    labSafetyNote: {
      ...Type.caption,
      color: c.text.tertiary,
      lineHeight: 17,
      marginBottom: 10,
    },
  });
