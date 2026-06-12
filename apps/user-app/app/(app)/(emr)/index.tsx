import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Fonts,
  Gradients,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import {
  AppHeader,
  AnimatedPressable,
  Card,
  Txt,
} from "../../../src/components/ui";
import { Button } from "../../../src/components/common/Button";
import { emrApi } from "../../../src/api/emr.api";

type Kind = "condition" | "allergy" | "surgery" | "immunization";
const SEV = ["MILD", "MODERATE", "SEVERE"] as const;
const makeSevColor = (c: Palette): Record<string, string> => ({
  SEVERE: "#D92D20",
  MODERATE: "#B54708",
  MILD: c.text.tertiary,
  UNKNOWN: c.text.tertiary,
});
const FILE_CATS = [
  { key: "LAB_REPORT", label: "Lab report" },
  { key: "IMAGING", label: "Imaging" },
  { key: "PRESCRIPTION", label: "Prescription" },
  { key: "DISCHARGE_SUMMARY", label: "Discharge" },
  { key: "VACCINATION_CARD", label: "Vaccine card" },
  { key: "INSURANCE", label: "Insurance" },
  { key: "OTHER", label: "Other" },
];

interface Rec {
  patient: {
    healthProfile?: {
      bloodType?: string;
      genotype?: string;
      heightCm?: number;
      weightKg?: number;
    } | null;
    medicalConditions?: {
      id: string;
      name: string;
      status: string;
      onsetDate?: string;
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
    }[];
  };
  clinicalNotes?: {
    id: string;
    assessment: string;
    plan: string;
    createdAt: string;
    doctor?: { name: string };
  }[];
}

interface Member {
  id: string;
  name: string;
  relation?: string;
  image?: string;
}

export default function MedicalRecordsScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const SEV_COLOR = makeSevColor(colors);
  const insets = useSafeAreaInsets();
  const [rec, setRec] = useState<Rec | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeSub, setActiveSub] = useState<string | undefined>(undefined); // undefined = the account holder
  const [editProfile, setEditProfile] = useState(false);
  const [addKind, setAddKind] = useState<Kind | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    emrApi
      .getRecord(activeSub)
      .then((r: unknown) => setRec((r as { data: Rec }).data))
      .catch(() => {});
  }, [activeSub]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    emrApi
      .getPatients()
      .then((r: unknown) => setMembers((r as { data: Member[] }).data ?? []))
      .catch(() => {});
  }, []);

  const del = async (type: Kind, id: string) => {
    try {
      await emrApi.deleteEntry(type, id);
      load();
    } catch {}
  };
  const delFile = async (id: string) => {
    try {
      await emrApi.deleteFile(id);
      load();
    } catch {}
  };

  const exportFhir = async () => {
    setExporting(true);
    try {
      const r = (await emrApi.getFhir(activeSub)) as { data: unknown };
      const uri = FileSystem.cacheDirectory + "doctium-medical-records.json";
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(r.data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/json",
          dialogTitle: "My medical records (FHIR)",
        });
      }
    } catch {
    } finally {
      setExporting(false);
    }
  };

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
      <AppHeader title="Medical records" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient switcher — the account holder + family members */}
        {members.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.switcher}
          >
            {[
              { id: undefined as string | undefined, name: "You" },
              ...members,
            ].map((m) => {
              const active = activeSub === m.id;
              return (
                <AnimatedPressable
                  key={m.id ?? "self"}
                  haptic="light"
                  onPress={() => setActiveSub(m.id)}
                  style={[styles.switchChip, active && styles.switchChipActive]}
                >
                  <Ionicons
                    name={m.id ? "people" : "person"}
                    size={14}
                    color={active ? "#fff" : colors.text.secondary}
                  />
                  <Text
                    style={[styles.switchText, active && { color: "#fff" }]}
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        )}

        {/* Health profile hero */}
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Health profile</Text>
            <AnimatedPressable
              haptic="light"
              onPress={() => setEditProfile(true)}
              style={styles.heroEdit}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.heroEditText}>Edit</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.heroGrid}>
            <HeroStat label="Blood type" value={prof?.bloodType || "—"} />
            <HeroStat label="Genotype" value={prof?.genotype || "—"} />
            <HeroStat
              label="Height"
              value={prof?.heightCm ? `${prof.heightCm}cm` : "—"}
            />
            <HeroStat
              label="Weight"
              value={prof?.weightKg ? `${prof.weightKg}kg` : "—"}
            />
          </View>
        </LinearGradient>

        <Section
          title="Allergies"
          icon="warning-outline"
          onAdd={() => setAddKind("allergy")}
          empty={!p.allergies?.length}
          emptyText="No allergies recorded."
        >
          {p.allergies?.map((a) => (
            <Row key={a.id} onDelete={() => del("allergy", a.id)}>
              <View
                style={[styles.dot, { backgroundColor: SEV_COLOR[a.severity] }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.substance}</Text>
                <Text style={styles.rowSub}>
                  {[a.reaction, a.severity.toLowerCase()]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </Row>
          ))}
        </Section>

        <Section
          title="Chronic conditions"
          icon="pulse-outline"
          onAdd={() => setAddKind("condition")}
          empty={!p.medicalConditions?.length}
          emptyText="No conditions recorded."
        >
          {p.medicalConditions?.map((c) => (
            <Row key={c.id} onDelete={() => del("condition", c.id)}>
              <Ionicons
                name={c.status === "ACTIVE" ? "ellipse" : "ellipse-outline"}
                size={11}
                color={
                  c.status === "ACTIVE" ? colors.teal : colors.text.tertiary
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowSub}>
                  {[c.status.toLowerCase(), c.onsetDate]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </Row>
          ))}
        </Section>

        <Section
          title="Past surgeries"
          icon="cut-outline"
          onAdd={() => setAddKind("surgery")}
          empty={!p.surgeries?.length}
          emptyText="No surgeries recorded."
        >
          {p.surgeries?.map((s) => (
            <Row key={s.id} onDelete={() => del("surgery", s.id)}>
              <Ionicons
                name="medical-outline"
                size={15}
                color={colors.text.tertiary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                <Text style={styles.rowSub}>
                  {[s.performedDate, s.hospital].filter(Boolean).join(" · ") ||
                    "—"}
                </Text>
              </View>
            </Row>
          ))}
        </Section>

        <Section
          title="Vaccinations"
          icon="shield-checkmark-outline"
          onAdd={() => setAddKind("immunization")}
          empty={!p.immunizations?.length}
          emptyText="No vaccinations recorded."
        >
          {p.immunizations?.map((im) => (
            <Row key={im.id} onDelete={() => del("immunization", im.id)}>
              <Ionicons
                name="checkmark-circle-outline"
                size={15}
                color={colors.teal}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{im.vaccine}</Text>
                <Text style={styles.rowSub}>
                  {[im.doseLabel, im.dateGiven].filter(Boolean).join(" · ") ||
                    "—"}
                </Text>
              </View>
            </Row>
          ))}
        </Section>

        <Section
          title="Documents"
          icon="document-attach-outline"
          onAdd={() => setUploadOpen(true)}
          addIcon="cloud-upload-outline"
          empty={!p.medicalFiles?.length}
          emptyText="No documents uploaded."
        >
          {p.medicalFiles?.map((f) => (
            <Row key={f.id} onDelete={() => delFile(f.id)}>
              <AnimatedPressable
                haptic="light"
                onPress={() => Linking.openURL(f.fileUrl).catch(() => {})}
                style={styles.fileRow}
              >
                <Ionicons name="document-text" size={18} color={colors.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {f.fileName}
                  </Text>
                  <Text style={styles.rowSub}>
                    {f.category.replace(/_/g, " ").toLowerCase()}
                  </Text>
                </View>
              </AnimatedPressable>
            </Row>
          ))}
        </Section>

        {/* Consultation notes (read-only) */}
        {rec.clinicalNotes && rec.clinicalNotes.length > 0 ? (
          <Card style={styles.card}>
            <View style={styles.secHead}>
              <Ionicons name="reader-outline" size={17} color={colors.teal} />
              <Txt variant="h3">Consultation notes</Txt>
            </View>
            <View style={{ gap: 10, marginTop: 8 }}>
              {rec.clinicalNotes.map((n) => (
                <View key={n.id} style={styles.noteCard}>
                  <View style={styles.noteHead}>
                    <Text style={styles.noteDr}>
                      Dr. {n.doctor?.name ?? "—"}
                    </Text>
                    <Text style={styles.noteDate}>
                      {new Date(n.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {n.assessment ? (
                    <Text style={styles.noteLine}>{n.assessment}</Text>
                  ) : null}
                  {n.plan ? (
                    <Text style={styles.notePlan}>Plan: {n.plan}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* FHIR export */}
        <AnimatedPressable
          haptic="medium"
          onPress={exportFhir}
          style={styles.exportBtn}
        >
          {exporting ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Ionicons name="download-outline" size={18} color={colors.teal} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.exportTitle}>Download my records</Text>
            <Text style={styles.exportSub}>
              Portable FHIR file you can share with any hospital
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.text.tertiary}
          />
        </AnimatedPressable>

        <View style={styles.disclaimer}>
          <Ionicons name="lock-closed" size={12} color={colors.text.tertiary} />
          <Text style={styles.disclaimerText}>
            Only doctors you book a consultation with can view your record.
          </Text>
        </View>
      </ScrollView>

      <EditProfileSheet
        visible={editProfile}
        profile={prof}
        subPatientId={activeSub}
        onClose={() => setEditProfile(false)}
        onSaved={() => {
          setEditProfile(false);
          load();
        }}
      />
      <AddEntrySheet
        kind={addKind}
        subPatientId={activeSub}
        onClose={() => setAddKind(null)}
        onSaved={() => {
          setAddKind(null);
          load();
        }}
      />
      <UploadSheet
        visible={uploadOpen}
        subPatientId={activeSub}
        onClose={() => setUploadOpen(false)}
        onSaved={() => {
          setUploadOpen(false);
          load();
        }}
        insetBottom={insets.bottom}
      />
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatVal}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  icon,
  onAdd,
  addIcon,
  empty,
  emptyText,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onAdd: () => void;
  addIcon?: keyof typeof Ionicons.glyphMap;
  empty?: boolean;
  emptyText: string;
  children?: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <Card style={styles.card}>
      <View style={styles.secHead}>
        <Ionicons name={icon} size={17} color={colors.teal} />
        <Txt variant="h3" style={{ flex: 1 }}>
          {title}
        </Txt>
        <AnimatedPressable haptic="light" onPress={onAdd} style={styles.addBtn}>
          <Ionicons name={addIcon ?? "add"} size={18} color={colors.teal} />
        </AnimatedPressable>
      </View>
      {empty ? (
        <Text style={styles.secEmpty}>{emptyText}</Text>
      ) : (
        <View style={{ gap: 12, marginTop: 10 }}>{children}</View>
      )}
    </Card>
  );
}

function Row({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={styles.entryRow}>
      {children}
      <Pressable onPress={onDelete} hitSlop={8} style={styles.delBtn}>
        <Ionicons name="trash-outline" size={15} color={colors.text.tertiary} />
      </Pressable>
    </View>
  );
}

/* ── Sheets ─────────────────────────────────────────────── */
function SheetShell({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Txt variant="h2" style={{ marginBottom: 16 }}>
            {title}
          </Txt>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fLabel}>{label}</Text>
      <TextInput
        style={styles.fInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        keyboardType={numeric ? "decimal-pad" : "default"}
      />
    </View>
  );
}

function EditProfileSheet({
  visible,
  profile,
  subPatientId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile?: Rec["patient"]["healthProfile"];
  subPatientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    bloodType: "",
    genotype: "",
    heightCm: "",
    weightKg: "",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible)
      setF({
        bloodType: profile?.bloodType ?? "",
        genotype: profile?.genotype ?? "",
        heightCm: profile?.heightCm ? String(profile.heightCm) : "",
        weightKg: profile?.weightKg ? String(profile.weightKg) : "",
      });
  }, [visible]);
  const save = async () => {
    setSaving(true);
    try {
      await emrApi.updateProfile({
        bloodType: f.bloodType,
        genotype: f.genotype,
        heightCm: f.heightCm ? Number(f.heightCm) : null,
        weightKg: f.weightKg ? Number(f.weightKg) : null,
        subPatientId,
      });
      onSaved();
    } catch {
    } finally {
      setSaving(false);
    }
  };
  return (
    <SheetShell visible={visible} onClose={onClose} title="Health profile">
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Blood type"
            value={f.bloodType}
            onChange={(v) => setF((s) => ({ ...s, bloodType: v }))}
            placeholder="O+"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Genotype"
            value={f.genotype}
            onChange={(v) => setF((s) => ({ ...s, genotype: v }))}
            placeholder="AA"
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Height (cm)"
            value={f.heightCm}
            onChange={(v) => setF((s) => ({ ...s, heightCm: v }))}
            placeholder="178"
            numeric
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Weight (kg)"
            value={f.weightKg}
            onChange={(v) => setF((s) => ({ ...s, weightKg: v }))}
            placeholder="74"
            numeric
          />
        </View>
      </View>
      <Button
        label="Save profile"
        onPress={save}
        loading={saving}
        style={{ marginTop: 4 }}
      />
    </SheetShell>
  );
}

const TITLES: Record<Kind, string> = {
  condition: "Add condition",
  allergy: "Add allergy",
  surgery: "Add surgery",
  immunization: "Add vaccination",
};

function AddEntrySheet({
  kind,
  subPatientId,
  onClose,
  onSaved,
}: {
  kind: Kind | null;
  subPatientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const SEV_COLOR = makeSevColor(colors);
  const [f, setF] = useState<Record<string, string>>({});
  const [sev, setSev] = useState("MILD");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setF({});
    setSev("MILD");
  }, [kind]);
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!kind) return;
    setSaving(true);
    try {
      if (kind === "condition")
        await emrApi.addCondition({
          name: f.name,
          onsetDate: f.onsetDate,
          subPatientId,
        });
      else if (kind === "allergy")
        await emrApi.addAllergy({
          substance: f.substance,
          reaction: f.reaction,
          severity: sev,
          subPatientId,
        });
      else if (kind === "surgery")
        await emrApi.addSurgery({
          name: f.name,
          performedDate: f.performedDate,
          hospital: f.hospital,
          subPatientId,
        });
      else
        await emrApi.addImmunization({
          vaccine: f.vaccine,
          doseLabel: f.doseLabel,
          dateGiven: f.dateGiven,
          subPatientId,
        });
      onSaved();
    } catch {
    } finally {
      setSaving(false);
    }
  };
  const ready =
    kind === "allergy"
      ? !!f.substance
      : kind === "immunization"
        ? !!f.vaccine
        : !!f.name;

  return (
    <SheetShell
      visible={!!kind}
      onClose={onClose}
      title={kind ? TITLES[kind] : ""}
    >
      {kind === "condition" && (
        <>
          <Field
            label="Condition"
            value={f.name ?? ""}
            onChange={set("name")}
            placeholder="e.g. Hypertension"
          />
          <Field
            label="Since (optional)"
            value={f.onsetDate ?? ""}
            onChange={set("onsetDate")}
            placeholder="2021"
          />
        </>
      )}
      {kind === "allergy" && (
        <>
          <Field
            label="Substance"
            value={f.substance ?? ""}
            onChange={set("substance")}
            placeholder="e.g. Penicillin"
          />
          <Field
            label="Reaction (optional)"
            value={f.reaction ?? ""}
            onChange={set("reaction")}
            placeholder="e.g. Rash"
          />
          <Text style={styles.fLabel}>Severity</Text>
          <View style={styles.chipRow}>
            {SEV.map((s) => (
              <AnimatedPressable
                key={s}
                haptic="light"
                onPress={() => setSev(s)}
                style={[
                  styles.chip,
                  sev === s && {
                    backgroundColor: SEV_COLOR[s],
                    borderColor: SEV_COLOR[s],
                  },
                ]}
              >
                <Text style={[styles.chipText, sev === s && { color: "#fff" }]}>
                  {s[0] + s.slice(1).toLowerCase()}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </>
      )}
      {kind === "surgery" && (
        <>
          <Field
            label="Procedure"
            value={f.name ?? ""}
            onChange={set("name")}
            placeholder="e.g. Appendectomy"
          />
          <Field
            label="When (optional)"
            value={f.performedDate ?? ""}
            onChange={set("performedDate")}
            placeholder="2019"
          />
          <Field
            label="Hospital (optional)"
            value={f.hospital ?? ""}
            onChange={set("hospital")}
            placeholder="Hospital name"
          />
        </>
      )}
      {kind === "immunization" && (
        <>
          <Field
            label="Vaccine"
            value={f.vaccine ?? ""}
            onChange={set("vaccine")}
            placeholder="e.g. Hepatitis B"
          />
          <Field
            label="Dose (optional)"
            value={f.doseLabel ?? ""}
            onChange={set("doseLabel")}
            placeholder="e.g. Booster"
          />
          <Field
            label="Date (optional)"
            value={f.dateGiven ?? ""}
            onChange={set("dateGiven")}
            placeholder="2024-01-15"
          />
        </>
      )}
      <Button
        label="Add"
        onPress={save}
        loading={saving}
        disabled={!ready}
        style={{ marginTop: 4 }}
      />
    </SheetShell>
  );
}

function UploadSheet({
  visible,
  subPatientId,
  onClose,
  onSaved,
  insetBottom,
}: {
  visible: boolean;
  subPatientId?: string;
  onClose: () => void;
  onSaved: () => void;
  insetBottom: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const [cat, setCat] = useState("LAB_REPORT");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setCat("LAB_REPORT");
  }, [visible]);

  const pick = async () => {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) {
        setBusy(false);
        return;
      }
      const a = res.assets[0];
      const b64 = await FileSystem.readAsStringAsync(a.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dataUrl = `data:${a.mimeType ?? "application/octet-stream"};base64,${b64}`;
      await emrApi.addFile({
        fileName: a.name,
        dataUrl,
        category: cat,
        mimeType: a.mimeType ?? "",
        sizeBytes: a.size,
        subPatientId,
      });
      onSaved();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheetWrap,
          { position: "absolute", bottom: 0, left: 0, right: 0 },
        ]}
      >
        <View style={[styles.sheet, { paddingBottom: insetBottom + 24 }]}>
          <View style={styles.handle} />
          <Txt variant="h2" style={{ marginBottom: 6 }}>
            Upload a document
          </Txt>
          <Text style={styles.uploadHint}>
            Lab reports, scans, prescriptions — PDF or photo.
          </Text>
          <Text style={styles.fLabel}>Category</Text>
          <View style={styles.chipWrap}>
            {FILE_CATS.map((c) => (
              <AnimatedPressable
                key={c.key}
                haptic="light"
                onPress={() => setCat(c.key)}
                style={[styles.chip, cat === c.key && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, cat === c.key && { color: "#fff" }]}
                >
                  {c.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
          <Button
            label={busy ? "Uploading…" : "Choose file"}
            onPress={pick}
            loading={busy}
            icon={
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            }
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 130, paddingTop: 4 },
    hero: {
      borderRadius: Radius.xl,
      padding: 18,
      marginBottom: 16,
      ...Shadow.card,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    heroLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    heroEdit: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(255,255,255,0.16)",
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 20,
    },
    heroEditText: { fontFamily: Fonts.semibold, fontSize: 12.5, color: "#fff" },
    heroGrid: { flexDirection: "row", gap: 10 },
    heroStat: { flex: 1 },
    heroStatVal: {
      fontFamily: Fonts.extrabold,
      fontSize: 19,
      color: "#fff",
      letterSpacing: -0.4,
    },
    heroStatLabel: {
      fontFamily: Fonts.medium,
      fontSize: 11,
      color: "rgba(255,255,255,0.7)",
      marginTop: 2,
    },
    card: { marginBottom: 14 },
    secHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    addBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.tealSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    secEmpty: { ...Type.bodySm, color: c.text.tertiary, marginTop: 8 },
    entryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    fileRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    rowTitle: { ...Type.bodyMed, color: c.text.primary },
    rowSub: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 1,
      textTransform: "capitalize",
    },
    delBtn: { padding: 4 },
    noteCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      padding: 12,
    },
    noteHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    noteDr: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.primary,
    },
    noteDate: { ...Type.caption, color: c.text.tertiary },
    noteLine: { ...Type.bodySm, color: c.text.secondary, lineHeight: 18 },
    notePlan: {
      ...Type.caption,
      color: c.teal,
      marginTop: 3,
      fontFamily: Fonts.medium,
    },
    exportBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    exportTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    exportSub: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    disclaimer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "center",
      marginTop: 16,
    },
    disclaimerText: { ...Type.caption, color: c.text.tertiary },
    switcher: {
      flexDirection: "row",
      gap: 8,
      paddingBottom: 14,
      paddingRight: 4,
    },
    switchChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      maxWidth: 160,
    },
    switchChipActive: { backgroundColor: c.navy, borderColor: c.navy },
    switchText: {
      fontFamily: Fonts.semibold,
      fontSize: 13.5,
      color: c.text.secondary,
    },
    // sheets
    backdrop: { flex: 1, backgroundColor: "rgba(8,18,32,0.4)" },
    sheetWrap: { justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      padding: Space.xxl,
      paddingBottom: 36,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginBottom: 16,
    },
    fLabel: { ...Type.label, color: c.text.secondary, marginBottom: 7 },
    fInput: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...Type.bodyMed,
      color: c.text.primary,
    },
    chipRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 4,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    chipActive: { backgroundColor: c.teal, borderColor: c.teal },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
    },
    uploadHint: {
      ...Type.caption,
      color: c.text.tertiary,
      marginBottom: 16,
    },
  });
