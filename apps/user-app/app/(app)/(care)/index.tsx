import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { careApi } from "../../../src/api/care.api";
import { usersApi } from "../../../src/api/users.api";
import { emrApi } from "../../../src/api/emr.api";
import { formatMoney } from "../../../src/utils/money";

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Program {
  id: string;
  code: string;
  name: string;
  condition: string;
  description: string;
  icon: string;
  price: number; // kobo; 0 = free
  vitals: { type: string }[];
  // SCD Phase 3: programs with genotype protocols ask for genotype at join
  genotypeConfig?: Record<string, unknown> | null;
}

const GENOTYPES = ["AA", "AS", "AC", "SS", "SC"] as const;
interface SubPatient {
  id: string;
  name: string;
  relation: string;
}
interface VitalMeta {
  label: string;
  unit: string;
  hasSecond: boolean;
}
interface Enrollment {
  id: string;
  program: Program;
  doctor: { name: string; image: string } | null;
  latestByType: Record<
    string,
    { value: number; value2: number | null; takenAt: string }
  >;
  openAlerts: number;
  subPatient: { id: string; name: string } | null;
  sponsorship: { organization: { name: string } } | null;
  adherence: {
    expectedPerWeek: number;
    readings7d: number;
    percent: number | null;
  } | null;
}

const safeIcon = (name: string): IoniconName =>
  (name && name in Ionicons.glyphMap ? name : "medkit") as IoniconName;

export default function CareHubScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  const [sponsored, setSponsored] = useState<
    { programId: string; orgName: string }[]
  >([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [vitalCatalog, setVitalCatalog] = useState<Record<string, VitalMeta>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([careApi.getCatalog(), careApi.getMine()])
      .then(([c, m]: unknown[]) => {
        const cd = (
          c as {
            data: {
              programs: Program[];
              enrolledProgramIds: string[];
              sponsoredPrograms: { programId: string; orgName: string }[];
              vitalCatalog: Record<string, VitalMeta>;
            };
          }
        ).data;
        const md = (m as { data: { enrollments: Enrollment[] } }).data;
        setPrograms(cd.programs ?? []);
        setEnrolledIds(cd.enrolledProgramIds ?? []);
        setSponsored(cd.sponsoredPrograms ?? []);
        setVitalCatalog(cd.vitalCatalog ?? {});
        setEnrollments(md.enrollments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Family picker: who is this program for?
  const [pickerProgram, setPickerProgram] = useState<Program | null>(null);
  const [members, setMembers] = useState<SubPatient[] | null>(null);
  // Genotype prompt (SCD Phase 3): asked once at join for genotype-tuned programs
  const [genotypeAsk, setGenotypeAsk] = useState<{
    program: Program;
    subPatientId?: string;
  } | null>(null);

  const enroll = async (
    program: Program,
    subPatientId?: string,
    genotype?: string,
  ) => {
    setEnrolling(program.id);
    setPickerProgram(null);
    setGenotypeAsk(null);
    try {
      await careApi.enroll(program.id, { subPatientId, genotype });
      load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not enroll. Please try again.";
      if (msg.toLowerCase().includes("insufficient")) {
        Alert.alert("Top up needed", msg, [
          { text: "Not now", style: "cancel" },
          {
            text: "Top up wallet",
            onPress: () => router.push("/(app)/(wallet)"),
          },
        ]);
      } else {
        Alert.alert("Enrollment", msg);
      }
    } finally {
      setEnrolling(null);
    }
  };

  /**
   * Genotype gate: programs with genotype protocols (e.g. sickle cell) ask for
   * the genotype once at join — unless the health profile already knows it.
   */
  const startEnroll = async (program: Program, subPatientId?: string) => {
    setPickerProgram(null);
    const hasGenotypeProtocols =
      !!program.genotypeConfig &&
      Object.keys(program.genotypeConfig).length > 0;
    if (!hasGenotypeProtocols) {
      enroll(program, subPatientId);
      return;
    }
    let known = "";
    try {
      const r: unknown = await emrApi.getRecord(subPatientId);
      known =
        (
          r as {
            data: { patient: { healthProfile: { genotype?: string } | null } };
          }
        ).data?.patient?.healthProfile?.genotype ?? "";
    } catch {
      known = "";
    }
    if (known.trim()) {
      enroll(program, subPatientId);
    } else {
      setGenotypeAsk({ program, subPatientId });
    }
  };

  const onJoin = async (program: Program) => {
    // Load family members once; no members → enroll the account holder directly.
    let list = members;
    if (list === null) {
      try {
        const r: unknown = await usersApi.getSubPatients();
        list = ((r as { data: SubPatient[] }).data ?? []) as SubPatient[];
      } catch {
        list = [];
      }
      setMembers(list);
    }
    if (!list.length) {
      startEnroll(program);
    } else {
      setPickerProgram(program);
    }
  };

  const fmtVital = (
    type: string,
    v: { value: number; value2: number | null },
  ) => {
    const meta = vitalCatalog[type];
    const val =
      meta?.hasSecond && v.value2 != null
        ? `${v.value}/${v.value2}`
        : `${v.value}`;
    return `${val} ${meta?.unit ?? ""}`.trim();
  };

  const explore = programs.filter((p) => !enrolledIds.includes(p.id));
  const sponsorOf = (programId: string) =>
    sponsored.find((s) => s.programId === programId)?.orgName;

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
          {enrollments.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>My programs</Text>
              {enrollments.map((e) => (
                <AnimatedPressable
                  key={e.id}
                  haptic="light"
                  onPress={() => router.push(`/(app)/(care)/${e.id}`)}
                  style={styles.card}
                >
                  <View style={styles.cardHead}>
                    <View style={styles.progIcon}>
                      <Ionicons
                        name={safeIcon(e.program.icon)}
                        size={20}
                        color={colors.teal}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.progName}>{e.program.name}</Text>
                      <Text style={styles.progMeta}>
                        {e.subPatient ? `For ${e.subPatient.name} · ` : ""}
                        {e.sponsorship
                          ? `Sponsored by ${e.sponsorship.organization.name} · `
                          : ""}
                        {e.doctor
                          ? `Care lead · Dr. ${e.doctor.name}`
                          : "No care lead yet"}
                      </Text>
                    </View>
                    {e.openAlerts > 0 ? (
                      <View style={styles.alertBadge}>
                        <Ionicons name="alert" size={11} color="#fff" />
                        <Text style={styles.alertBadgeText}>
                          {e.openAlerts}
                        </Text>
                      </View>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.text.tertiary}
                      />
                    )}
                  </View>
                  {Object.keys(e.latestByType).length > 0 ? (
                    <View style={styles.vitalsRow}>
                      {Object.entries(e.latestByType).map(([type, v]) => (
                        <View key={type} style={styles.vitalChip}>
                          <Text style={styles.vitalChipLabel}>
                            {vitalCatalog[type]?.label ?? type}
                          </Text>
                          <Text style={styles.vitalChipValue}>
                            {fmtVital(type, v)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noReadings}>
                      No readings yet — tap to log your first one
                    </Text>
                  )}
                  {e.adherence?.percent != null ? (
                    <Text style={styles.adherenceLine}>
                      This week ·{" "}
                      <Text
                        style={{
                          fontFamily: Fonts.bold,
                          color:
                            e.adherence.percent >= 70
                              ? colors.teal
                              : e.adherence.percent >= 40
                                ? colors.warning
                                : colors.error,
                        }}
                      >
                        {e.adherence.percent}% on track
                      </Text>{" "}
                      ({e.adherence.readings7d}/{e.adherence.expectedPerWeek}{" "}
                      readings)
                    </Text>
                  ) : null}
                </AnimatedPressable>
              ))}
            </>
          ) : null}

          {explore.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>
                {enrollments.length
                  ? "Explore more programs"
                  : "Programs for you"}
              </Text>
              {explore.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.progIcon}>
                      <Ionicons
                        name={safeIcon(p.icon)}
                        size={20}
                        color={colors.teal}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.progName}>{p.name}</Text>
                      <Text style={styles.progMeta}>{p.condition}</Text>
                    </View>
                  </View>
                  <Text style={styles.progDesc}>{p.description}</Text>
                  <AnimatedPressable
                    haptic="medium"
                    onPress={() => onJoin(p)}
                    style={styles.enrollBtn}
                  >
                    {enrolling === p.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={16} color="#fff" />
                        <Text style={styles.enrollText}>
                          {sponsorOf(p.id)
                            ? `Join — covered by ${sponsorOf(p.id)}`
                            : p.price > 0
                              ? `Join — ${formatMoney(p.price)} from wallet`
                              : "Join program — free"}
                        </Text>
                      </>
                    )}
                  </AnimatedPressable>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.disclaimer}>
            Care programs support — but don't replace — your doctor. If you feel
            unwell, book a consultation or seek urgent care immediately.
          </Text>

          {/* ── Who is this for? (family picker) ── */}
          <Modal
            visible={!!pickerProgram}
            animationType="slide"
            transparent
            onRequestClose={() => setPickerProgram(null)}
          >
            <View style={styles.overlay}>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Txt variant="h2" style={{ marginBottom: 4 }}>
                  Who is this program for?
                </Txt>
                <Txt
                  variant="body"
                  color={colors.text.secondary}
                  style={{ marginBottom: 16 }}
                >
                  {pickerProgram?.name}
                  {pickerProgram && sponsorOf(pickerProgram.id)
                    ? ` · covered by ${sponsorOf(pickerProgram.id)}`
                    : pickerProgram && pickerProgram.price > 0
                      ? ` · ${formatMoney(pickerProgram.price)} from wallet`
                      : " · free"}
                </Txt>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => pickerProgram && startEnroll(pickerProgram)}
                  style={styles.memberRow}
                >
                  <View style={styles.memberIcon}>
                    <Ionicons name="person" size={17} color={colors.navyMid} />
                  </View>
                  <Text style={styles.memberName}>Myself</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={colors.text.tertiary}
                  />
                </AnimatedPressable>
                {(members ?? []).map((m) => (
                  <AnimatedPressable
                    key={m.id}
                    haptic="light"
                    onPress={() =>
                      pickerProgram && startEnroll(pickerProgram, m.id)
                    }
                    style={styles.memberRow}
                  >
                    <View style={styles.memberIcon}>
                      <Ionicons name="people" size={17} color={colors.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberRelation}>
                        {m.relation || "Family member"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color={colors.text.tertiary}
                    />
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          </Modal>

          {/* ── What's the genotype? (genotype-tuned programs) ── */}
          <Modal
            visible={!!genotypeAsk}
            animationType="slide"
            transparent
            onRequestClose={() => setGenotypeAsk(null)}
          >
            <View style={styles.overlay}>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Txt variant="h2" style={{ marginBottom: 4 }}>
                  What's the genotype?
                </Txt>
                <Txt
                  variant="body"
                  color={colors.text.secondary}
                  style={{ marginBottom: 16 }}
                >
                  {genotypeAsk?.program.name} personalizes targets and check-ins
                  by genotype. It's saved to the medical record too.
                </Txt>
                <View style={styles.genotypeGrid}>
                  {GENOTYPES.map((g) => (
                    <AnimatedPressable
                      key={g}
                      haptic="light"
                      onPress={() =>
                        genotypeAsk &&
                        enroll(genotypeAsk.program, genotypeAsk.subPatientId, g)
                      }
                      style={styles.genotypeChip}
                    >
                      <Text style={styles.genotypeChipText}>{g}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
                <AnimatedPressable
                  haptic="light"
                  onPress={() =>
                    genotypeAsk &&
                    enroll(genotypeAsk.program, genotypeAsk.subPatientId)
                  }
                  style={styles.genotypeSkip}
                >
                  <Text style={styles.genotypeSkipText}>
                    I'm not sure — continue without it
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          </Modal>
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
    sectionTitle: {
      ...Type.overline,
      color: c.text.tertiary,
      marginTop: 18,
      marginBottom: 10,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    progIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    progName: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    progMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    progDesc: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginTop: 12,
      lineHeight: 19,
    },
    alertBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: c.error,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    alertBadgeText: { fontFamily: Fonts.bold, fontSize: 12, color: "#fff" },
    vitalsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    vitalChip: {
      backgroundColor: c.background,
      borderRadius: Radius.lg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    vitalChipLabel: {
      ...Type.caption,
      fontSize: 10.5,
      color: c.text.tertiary,
    },
    vitalChipValue: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: c.text.primary,
      marginTop: 2,
    },
    noReadings: { ...Type.caption, color: c.text.tertiary, marginTop: 12 },
    adherenceLine: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 10,
    },
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
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    memberIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    memberName: {
      ...Type.bodyMed,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
      flex: 1,
    },
    memberRelation: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 1,
    },
    enrollBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.navy,
      paddingVertical: 12,
      borderRadius: Radius.round,
      marginTop: 14,
    },
    enrollText: { fontFamily: Fonts.bold, fontSize: 13.5, color: "#fff" },
    disclaimer: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 17,
      paddingHorizontal: 10,
    },
    genotypeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 14,
    },
    genotypeChip: {
      minWidth: 64,
      alignItems: "center",
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingVertical: 13,
      paddingHorizontal: 18,
    },
    genotypeChipText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: c.text.primary,
    },
    genotypeSkip: { alignItems: "center", paddingVertical: 10 },
    genotypeSkipText: { ...Type.caption, color: c.text.tertiary },
  });
