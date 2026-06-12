import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { AppHeader, Card, Txt } from "../../../src/components/ui";
import { AnimatedPressable } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface PatientRecord {
  patient: {
    id: string;
    name: string;
    image?: string;
    mobile?: string;
    gender?: string;
    dob?: string;
    age?: number;
    healthProfile?: {
      bloodType?: string;
      genotype?: string;
      heightCm?: number;
      weightKg?: number;
      notes?: string;
    } | null;
    medicalConditions?: {
      id: string;
      name: string;
      status: string;
      onsetDate?: string;
      notes?: string;
    }[];
    allergies?: {
      id: string;
      substance: string;
      reaction?: string;
      severity: string;
    }[];
    surgeries?: {
      id: string;
      name: string;
      performedDate?: string;
      hospital?: string;
    }[];
    immunizations?: {
      id: string;
      vaccine: string;
      doseLabel?: string;
      dateGiven?: string;
    }[];
    medicalFiles?: {
      id: string;
      fileName: string;
      fileUrl: string;
      category: string;
      createdAt: string;
    }[];
  };
  clinicalNotes?: {
    id: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    createdAt: string;
    doctor?: { name: string; designation?: string };
  }[];
  prescriptions?: {
    id: string;
    diagnosis: string;
    createdAt: string;
    doctor?: { name: string };
    _count?: { items: number };
  }[];
}

const sevColor = (c: Palette): Record<string, string> => ({
  SEVERE: "#B42318",
  MODERATE: "#B54708",
  MILD: c.text.secondary,
  UNKNOWN: c.text.tertiary,
});

export default function PatientHistoryScreen() {
  const { userId, subPatientId } = useLocalSearchParams<{
    userId: string;
    subPatientId?: string;
  }>();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const SEV_COLOR = sevColor(colors);
  const [rec, setRec] = useState<PatientRecord | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    doctorApi
      .getPatientRecord(userId, subPatientId)
      .then((r: unknown) => setRec((r as { data: PatientRecord }).data))
      .catch(() => setErr(true));
  }, [userId, subPatientId]);

  if (err) {
    return (
      <View style={styles.root}>
        <AppHeader title="Patient history" />
        <View style={styles.center}>
          <Ionicons
            name="lock-closed-outline"
            size={40}
            color={colors.text.tertiary}
          />
          <Text style={styles.emptyText}>
            You can only view records of your own patients.
          </Text>
        </View>
      </View>
    );
  }
  if (!rec) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  const p = rec.patient;
  const prof = p.healthProfile;

  return (
    <View style={styles.root}>
      <AppHeader title="Patient history" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.patientRow}>
            <Avatar name={p.name} uri={p.image} size={54} ring />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>
                {[p.gender, p.age ? `${p.age} yrs` : p.dob]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Text>
            </View>
          </View>
          <View style={styles.profileGrid}>
            <Metric label="Blood type" value={prof?.bloodType || "—"} />
            <Metric label="Genotype" value={prof?.genotype || "—"} />
            <Metric
              label="Height"
              value={prof?.heightCm ? `${prof.heightCm} cm` : "—"}
            />
            <Metric
              label="Weight"
              value={prof?.weightKg ? `${prof.weightKg} kg` : "—"}
            />
          </View>
        </Card>

        <Section
          title="Allergies"
          icon="warning-outline"
          empty={!p.allergies?.length}
        >
          {p.allergies?.map((a) => (
            <View key={a.id} style={styles.entry}>
              <View
                style={[
                  styles.sevDot,
                  { backgroundColor: SEV_COLOR[a.severity] },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{a.substance}</Text>
                {a.reaction ? (
                  <Text style={styles.entrySub}>
                    {a.reaction} · {a.severity.toLowerCase()}
                  </Text>
                ) : (
                  <Text style={styles.entrySub}>
                    {a.severity.toLowerCase()}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Section>

        <Section
          title="Chronic conditions"
          icon="pulse-outline"
          empty={!p.medicalConditions?.length}
        >
          {p.medicalConditions?.map((c) => (
            <View key={c.id} style={styles.entry}>
              <Ionicons
                name={c.status === "ACTIVE" ? "ellipse" : "ellipse-outline"}
                size={10}
                color={
                  c.status === "ACTIVE" ? colors.tealDeep : colors.text.tertiary
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{c.name}</Text>
                <Text style={styles.entrySub}>
                  {[c.status.toLowerCase(), c.onsetDate]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section
          title="Past surgeries"
          icon="cut-outline"
          empty={!p.surgeries?.length}
        >
          {p.surgeries?.map((s) => (
            <View key={s.id} style={styles.entry}>
              <Ionicons
                name="medical-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{s.name}</Text>
                <Text style={styles.entrySub}>
                  {[s.performedDate, s.hospital].filter(Boolean).join(" · ") ||
                    "—"}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section
          title="Vaccinations"
          icon="shield-checkmark-outline"
          empty={!p.immunizations?.length}
        >
          {p.immunizations?.map((im) => (
            <View key={im.id} style={styles.entry}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color={colors.tealDeep}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{im.vaccine}</Text>
                <Text style={styles.entrySub}>
                  {[im.doseLabel, im.dateGiven].filter(Boolean).join(" · ") ||
                    "—"}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section
          title="Documents"
          icon="document-attach-outline"
          empty={!p.medicalFiles?.length}
        >
          {p.medicalFiles?.map((f) => (
            <AnimatedPressable
              key={f.id}
              haptic="light"
              onPress={() => Linking.openURL(f.fileUrl).catch(() => {})}
              style={styles.entry}
            >
              <Ionicons name="document-text" size={16} color={colors.teal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle} numberOfLines={1}>
                  {f.fileName}
                </Text>
                <Text style={styles.entrySub}>
                  {f.category.replace(/_/g, " ").toLowerCase()}
                </Text>
              </View>
              <Ionicons
                name="open-outline"
                size={15}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>
          ))}
        </Section>

        <Section
          title="Consultation notes"
          icon="reader-outline"
          empty={!rec.clinicalNotes?.length}
        >
          {rec.clinicalNotes?.map((n) => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteHead}>
                <Text style={styles.noteDr}>Dr. {n.doctor?.name ?? "—"}</Text>
                <Text style={styles.noteDate}>
                  {new Date(n.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {n.assessment ? (
                <Text style={styles.noteLine}>
                  <Text style={styles.noteKey}>A: </Text>
                  {n.assessment}
                </Text>
              ) : null}
              {n.plan ? (
                <Text style={styles.noteLine}>
                  <Text style={styles.noteKey}>P: </Text>
                  {n.plan}
                </Text>
              ) : null}
              {n.bloodPressure || n.heartRate || n.temperature ? (
                <Text style={styles.noteVitals}>
                  {[
                    n.bloodPressure && `BP ${n.bloodPressure}`,
                    n.heartRate && `HR ${n.heartRate}`,
                    n.temperature && `${n.temperature}°C`,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              ) : null}
            </View>
          ))}
        </Section>

        <Section
          title="Prescriptions"
          icon="document-text-outline"
          empty={!rec.prescriptions?.length}
        >
          {rec.prescriptions?.map((rx) => (
            <View key={rx.id} style={styles.entry}>
              <Ionicons
                name="medkit-outline"
                size={15}
                color={colors.text.tertiary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>
                  {rx.diagnosis || "Prescription"}
                </Text>
                <Text style={styles.entrySub}>
                  {rx._count?.items ?? 0} item(s) ·{" "}
                  {new Date(rx.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  empty?: boolean;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.card}>
      <View style={styles.secHead}>
        <Ionicons name={icon} size={17} color={colors.tealDeep} />
        <Txt variant="h3">{title}</Txt>
      </View>
      {empty ? (
        <Text style={styles.secEmpty}>None on file.</Text>
      ) : (
        <View style={{ gap: 10, marginTop: 8 }}>{children}</View>
      )}
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 30,
    },
    emptyText: {
      ...Type.body,
      color: c.text.secondary,
      textAlign: "center",
    },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    card: { marginBottom: 14 },
    patientRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    name: { ...Type.h3, color: c.text.primary },
    meta: {
      ...Type.caption,
      color: c.text.secondary,
      marginTop: 3,
      textTransform: "capitalize",
    },
    profileGrid: { flexDirection: "row", marginTop: 16, gap: 8 },
    metric: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      paddingVertical: 10,
      alignItems: "center",
    },
    metricVal: {
      fontFamily: Fonts.bold,
      fontSize: 15,
      color: c.text.primary,
    },
    metricLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    secHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    secEmpty: { ...Type.bodySm, color: c.text.tertiary, marginTop: 6 },
    entry: { flexDirection: "row", alignItems: "center", gap: 10 },
    sevDot: { width: 9, height: 9, borderRadius: 5 },
    entryTitle: { ...Type.bodyMed, color: c.text.primary },
    entrySub: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 1,
      textTransform: "capitalize",
    },
    noteCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      padding: 12,
    },
    noteHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 5,
    },
    noteDr: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.primary,
    },
    noteDate: { ...Type.caption, color: c.text.tertiary },
    noteLine: { ...Type.bodySm, color: c.text.secondary, lineHeight: 18 },
    noteKey: { fontFamily: Fonts.bold, color: c.text.primary },
    noteVitals: {
      ...Type.caption,
      color: c.tealDeep,
      marginTop: 5,
      fontFamily: Fonts.medium,
    },
  });
