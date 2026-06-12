import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  Fonts,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../../src/theme";
import { Button } from "../../../../src/components/common/Button";
import { AppHeader } from "../../../../src/components/ui";
import { doctorApi } from "../../../../src/api/doctor.api";

type Form = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSat: string;
  weightKg: string;
  heightCm: string;
};
const EMPTY: Form = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  bloodPressure: "",
  heartRate: "",
  temperature: "",
  respiratoryRate: "",
  oxygenSat: "",
  weightKg: "",
  heightCm: "",
};

type SoapDraft = Pick<Form, "subjective" | "objective" | "assessment" | "plan">;

// Action hub: suggestions extracted with the AI draft. Every chip routes
// through an existing doctor-confirmed flow — nothing auto-commits.
type Suggestions = {
  prescriptionItems: {
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
  referral: { specialty: string; reason: string } | null;
  recallDays: number | null;
  conditions: string[];
  allergies: { substance: string; reaction: string }[];
  program: { id: string; name: string; condition: string } | null;
};
type PatientRef = { userId: string; subPatientId: string | null };

const hasSuggestions = (s: Suggestions | null): s is Suggestions =>
  !!s &&
  (s.prescriptionItems.length > 0 ||
    !!s.referral ||
    s.recallDays != null ||
    s.conditions.length > 0 ||
    s.allergies.length > 0 ||
    !!s.program);

const REC_MAX_SECONDS = 180; // ~3 min keeps the upload well under the API audio cap

export default function SoapEditorScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Scribe state: chat/dictation/recording draft in flight, recorder, provenance banner
  const [drafting, setDrafting] = useState<
    null | "chat" | "dictation" | "recording"
  >(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [patientRef, setPatientRef] = useState<PatientRef | null>(null);
  const [doneActions, setDoneActions] = useState<Set<string>>(new Set());
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    doctorApi
      .getClinicalNote(appointmentId)
      .then((r: unknown) => {
        const n = (
          r as {
            data:
              | (Partial<Form> & {
                  aiDrafted?: boolean;
                  aiDraftSource?: string;
                  aiSuggestions?: Partial<Suggestions>;
                  userId?: string;
                  subPatientId?: string | null;
                })
              | null;
          }
        ).data;
        if (n?.aiDrafted) {
          setAiInfo(
            `This note used an AI draft (${
              n.aiDraftSource === "DICTATION"
                ? "dictation"
                : n.aiDraftSource === "RECORDING"
                  ? "consult recording"
                  : "consult chat"
            }).`,
          );
        }
        // Re-hydrate the action chips persisted with the draft
        if (n?.aiSuggestions && n.userId) {
          setSuggestions({
            prescriptionItems: n.aiSuggestions.prescriptionItems ?? [],
            referral: n.aiSuggestions.referral ?? null,
            recallDays: n.aiSuggestions.recallDays ?? null,
            conditions: n.aiSuggestions.conditions ?? [],
            allergies: n.aiSuggestions.allergies ?? [],
            program: n.aiSuggestions.program ?? null,
          });
          setPatientRef({
            userId: n.userId,
            subPatientId: n.subPatientId ?? null,
          });
        }
        if (n) {
          setForm({
            subjective: n.subjective ?? "",
            objective: n.objective ?? "",
            assessment: n.assessment ?? "",
            plan: n.plan ?? "",
            bloodPressure: n.bloodPressure ?? "",
            heartRate: n.heartRate != null ? String(n.heartRate) : "",
            temperature: n.temperature != null ? String(n.temperature) : "",
            respiratoryRate:
              n.respiratoryRate != null ? String(n.respiratoryRate) : "",
            oxygenSat: n.oxygenSat != null ? String(n.oxygenSat) : "",
            weightKg: n.weightKg != null ? String(n.weightKg) : "",
            heightCm: n.heightCm != null ? String(n.heightCm) : "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [appointmentId]);

  const set = (k: keyof Form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── Scribe: AI draft → review-then-apply ──────────────────
  const applyDraft = (draft: SoapDraft, sourceLabel: string) => {
    const fill = () => {
      setForm((f) => ({
        ...f,
        subjective: draft.subjective ?? "",
        objective: draft.objective ?? "",
        assessment: draft.assessment ?? "",
        plan: draft.plan ?? "",
      }));
      setAiInfo(
        `AI-drafted from ${sourceLabel} — review and edit before saving.`,
      );
    };
    const hasText = [
      form.subjective,
      form.objective,
      form.assessment,
      form.plan,
    ].some((s) => s.trim() !== "");
    if (hasText) {
      Alert.alert(
        "Replace note text?",
        "The AI draft will replace what's currently in the SOAP fields. Vitals are kept.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: fill },
        ],
      );
    } else {
      fill();
    }
  };

  const requestDraft = async (
    source: "chat" | "dictation" | "recording",
    audio?: string,
  ) => {
    setDrafting(source);
    try {
      const r: unknown = await doctorApi.draftClinicalNote(appointmentId, {
        source,
        ...(audio ? { audio, mimeType: "audio/m4a" } : {}),
      });
      const d = (
        r as {
          data: {
            draft: SoapDraft;
            suggestions: Suggestions;
            patient: PatientRef;
          };
        }
      ).data;
      setSuggestions(d.suggestions ?? null);
      setPatientRef(d.patient ?? null);
      setDoneActions(new Set());
      applyDraft(
        d.draft,
        source === "dictation"
          ? "your dictation"
          : source === "recording"
            ? "the consult recording"
            : "the consult chat",
      );
    } catch (e) {
      Alert.alert(
        "Couldn't draft the note",
        (e as { message?: string })?.message ??
          "Something went wrong — please try again.",
      );
    } finally {
      setDrafting(null);
    }
  };

  const startRecording = async () => {
    if (drafting || recording) return;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecSeconds(0);
      recTimer.current = setInterval(
        () =>
          setRecSeconds((s) => {
            if (s + 1 >= REC_MAX_SECONDS) void stopRecording(true);
            return s + 1;
          }),
        1000,
      );
    } catch {
      setRecording(false);
    }
  };

  const stopRecording = async (use: boolean) => {
    if (recTimer.current) clearInterval(recTimer.current);
    const seconds = recSeconds;
    setRecording(false);
    setRecSeconds(0);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!use || !uri || seconds < 2) return;
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await requestDraft("dictation", b64);
    } catch {
      setDrafting(null);
    }
  };

  // ── Action hub: each chip routes through an existing confirmed flow ──
  const markDone = (key: string) => setDoneActions((s) => new Set(s).add(key));

  const openPrescription = () => {
    if (!suggestions?.prescriptionItems.length) return;
    router.push({
      pathname: "/(app)/(prescriptions)/create",
      params: {
        appointmentId,
        prefill: JSON.stringify({
          diagnosis: form.assessment,
          items: suggestions.prescriptionItems,
        }),
      },
    });
    markDone("rx");
  };

  const openReferral = () => {
    if (!suggestions?.referral) return;
    router.push({
      pathname: "/(app)/(referrals)/new",
      params: {
        appointmentId,
        specialty: suggestions.referral.specialty,
        reason: suggestions.referral.reason,
      },
    });
    markDone("referral");
  };

  const confirmAction = (
    title: string,
    message: string,
    key: string,
    run: () => Promise<unknown>,
  ) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          run()
            .then(() => markDone(key))
            .catch((e) =>
              Alert.alert(
                "Couldn't complete that",
                (e as { message?: string })?.message ?? "Please try again.",
              ),
            );
        },
      },
    ]);
  };

  const scheduleRecall = () => {
    const days = suggestions?.recallDays;
    if (!days) return;
    confirmAction(
      "Schedule recall?",
      `The patient will be reminded to book a follow-up in ${days} day${days === 1 ? "" : "s"}.`,
      "recall",
      () => doctorApi.scheduleFollowUp(appointmentId, days),
    );
  };

  const addCondition = (name: string) => {
    if (!patientRef) return;
    confirmAction(
      "Add to problem list?",
      `"${name}" will be recorded as a condition on the patient's medical record.`,
      `condition:${name}`,
      () =>
        doctorApi.addPatientCondition(patientRef.userId, {
          name,
          subPatientId: patientRef.subPatientId ?? undefined,
        }),
    );
  };

  const addAllergy = (a: { substance: string; reaction: string }) => {
    if (!patientRef) return;
    confirmAction(
      "Record allergy?",
      `"${a.substance}" will be added to the patient's allergy list.`,
      `allergy:${a.substance}`,
      () =>
        doctorApi.addPatientAllergy(patientRef.userId, {
          substance: a.substance,
          reaction: a.reaction,
          subPatientId: patientRef.subPatientId ?? undefined,
        }),
    );
  };

  const suggestProgram = () => {
    const p = suggestions?.program;
    if (!p) return;
    confirmAction(
      "Recommend care program?",
      `The patient will get a notification recommending the ${p.name} program. Joining stays their choice.`,
      "program",
      () => doctorApi.suggestCareProgram(appointmentId, p.id),
    );
  };

  const save = async () => {
    setSaving(true);
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    try {
      await doctorApi.saveClinicalNote({
        appointmentId,
        subjective: form.subjective,
        objective: form.objective,
        assessment: form.assessment,
        plan: form.plan,
        bloodPressure: form.bloodPressure,
        heartRate: num(form.heartRate),
        temperature: num(form.temperature),
        respiratoryRate: num(form.respiratoryRate),
        oxygenSat: num(form.oxygenSat),
        weightKg: num(form.weightKg),
        heightCm: num(form.heightCm),
      });
      router.back();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="SOAP note" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? <Text style={styles.hint}>Loading…</Text> : null}

          <View style={styles.aiCard}>
            {recording ? (
              <>
                <View style={styles.aiRow}>
                  <View style={styles.recDot} />
                  <Text style={styles.aiTitle}>
                    Recording… {Math.floor(recSeconds / 60)}:
                    {String(recSeconds % 60).padStart(2, "0")}
                  </Text>
                </View>
                <Text style={styles.aiHint}>
                  Summarise the visit: symptoms, findings, your assessment and
                  the plan.
                </Text>
                <View style={styles.aiActions}>
                  <Pressable
                    style={[styles.aiBtn, styles.aiBtnPrimary]}
                    onPress={() => stopRecording(true)}
                  >
                    <Ionicons name="checkmark" size={15} color="#fff" />
                    <Text style={[styles.aiBtnText, { color: "#fff" }]}>
                      Use recording
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.aiBtn}
                    onPress={() => stopRecording(false)}
                  >
                    <Text style={styles.aiBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : drafting ? (
              <View style={styles.aiRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.aiTitle}>
                  {drafting === "dictation"
                    ? "Transcribing & drafting…"
                    : drafting === "recording"
                      ? "Transcribing the consult recording…"
                      : "Drafting from the consult chat…"}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.aiRow}>
                  <Ionicons name="sparkles" size={15} color={colors.primary} />
                  <Text style={styles.aiTitle}>Draft with AI</Text>
                </View>
                <Text style={styles.aiHint}>
                  Build this note from the consultation chat, or dictate a quick
                  summary. You review everything before saving.
                </Text>
                <View style={styles.aiActions}>
                  <Pressable
                    style={styles.aiBtn}
                    onPress={() => void requestDraft("chat")}
                  >
                    <Ionicons
                      name="chatbubbles-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.aiBtnText}>From chat</Text>
                  </Pressable>
                  <Pressable style={styles.aiBtn} onPress={startRecording}>
                    <Ionicons
                      name="mic-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.aiBtnText}>Dictate</Text>
                  </Pressable>
                  <Pressable
                    style={styles.aiBtn}
                    onPress={() => void requestDraft("recording")}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.aiBtnText}>Recording</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          {aiInfo ? (
            <View style={styles.aiBanner}>
              <Ionicons name="sparkles" size={13} color={colors.primary} />
              <Text style={styles.aiBannerText}>{aiInfo}</Text>
            </View>
          ) : null}

          {hasSuggestions(suggestions) ? (
            <View style={styles.chipsWrap}>
              <Text style={styles.chipsTitle}>Suggested actions</Text>
              <View style={styles.chips}>
                {suggestions.prescriptionItems.length > 0 ? (
                  <ActionChip
                    icon="medkit-outline"
                    label={`Prescribe ${suggestions.prescriptionItems[0]?.drugName ?? ""}${
                      suggestions.prescriptionItems.length > 1
                        ? ` +${suggestions.prescriptionItems.length - 1} more`
                        : ""
                    }`}
                    done={doneActions.has("rx")}
                    onPress={openPrescription}
                  />
                ) : null}
                {suggestions.referral ? (
                  <ActionChip
                    icon="git-branch-outline"
                    label={`Refer to ${suggestions.referral.specialty}`}
                    done={doneActions.has("referral")}
                    onPress={openReferral}
                  />
                ) : null}
                {suggestions.recallDays != null ? (
                  <ActionChip
                    icon="calendar-outline"
                    label={`Recall in ${suggestions.recallDays} day${
                      suggestions.recallDays === 1 ? "" : "s"
                    }`}
                    done={doneActions.has("recall")}
                    onPress={scheduleRecall}
                  />
                ) : null}
                {suggestions.conditions.map((cnd) => (
                  <ActionChip
                    key={cnd}
                    icon="pulse-outline"
                    label={`Add condition: ${cnd}`}
                    done={doneActions.has(`condition:${cnd}`)}
                    onPress={() => addCondition(cnd)}
                  />
                ))}
                {suggestions.allergies.map((a) => (
                  <ActionChip
                    key={a.substance}
                    icon="alert-circle-outline"
                    label={`Record allergy: ${a.substance}`}
                    done={doneActions.has(`allergy:${a.substance}`)}
                    onPress={() => addAllergy(a)}
                  />
                ))}
                {suggestions.program ? (
                  <ActionChip
                    icon="heart-circle-outline"
                    label={`Suggest ${suggestions.program.name} program`}
                    done={doneActions.has("program")}
                    onPress={suggestProgram}
                  />
                ) : null}
              </View>
              <Text style={styles.chipsFootnote}>
                Each action opens for your review or asks you to confirm —
                nothing is sent automatically.
              </Text>
            </View>
          ) : null}

          <Field
            label="Subjective"
            hint="Patient's reported symptoms & history"
            value={form.subjective}
            onChange={set("subjective")}
            tall
          />
          <Field
            label="Objective"
            hint="Examination findings"
            value={form.objective}
            onChange={set("objective")}
            tall
          />

          <Text style={styles.section}>Vitals</Text>
          <View style={styles.vitalsGrid}>
            <Vital
              label="Blood pressure"
              value={form.bloodPressure}
              onChange={set("bloodPressure")}
              placeholder="120/80"
            />
            <Vital
              label="Heart rate (bpm)"
              value={form.heartRate}
              onChange={set("heartRate")}
              placeholder="72"
              numeric
            />
            <Vital
              label="Temp (°C)"
              value={form.temperature}
              onChange={set("temperature")}
              placeholder="36.8"
              numeric
            />
            <Vital
              label="Resp. rate"
              value={form.respiratoryRate}
              onChange={set("respiratoryRate")}
              placeholder="16"
              numeric
            />
            <Vital
              label="SpO₂ (%)"
              value={form.oxygenSat}
              onChange={set("oxygenSat")}
              placeholder="98"
              numeric
            />
            <Vital
              label="Weight (kg)"
              value={form.weightKg}
              onChange={set("weightKg")}
              placeholder="74"
              numeric
            />
          </View>

          <Field
            label="Assessment"
            hint="Working diagnosis / impression"
            value={form.assessment}
            onChange={set("assessment")}
            tall
          />
          <Field
            label="Plan"
            hint="Treatment, follow-up, referrals"
            value={form.plan}
            onChange={set("plan")}
            tall
          />

          <Button
            label="Save note"
            onPress={save}
            loading={saving}
            style={{ marginTop: 8 }}
          />
          <Text style={styles.footnote}>
            One SOAP note per consultation. Saving again updates this note.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  tall,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  tall?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, tall && { height: 92 }]}
        value={value}
        onChangeText={onChange}
        placeholder="…"
        placeholderTextColor={colors.text.tertiary}
        multiline={tall}
        textAlignVertical={tall ? "top" : "center"}
      />
    </View>
  );
}

function ActionChip({
  icon,
  label,
  done,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  done: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={[styles.chip, done && styles.chipDone]}
      onPress={onPress}
      disabled={done}
    >
      <Ionicons
        name={done ? "checkmark-circle" : icon}
        size={14}
        color={done ? colors.teal : colors.primary}
      />
      <Text
        style={[styles.chipText, done && styles.chipTextDone]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Vital({
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.vital}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <TextInput
        style={styles.vitalInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        keyboardType={numeric ? "decimal-pad" : "default"}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 50, paddingTop: 6 },
    hint: { ...Type.caption, color: c.text.tertiary, marginBottom: 10 },
    label: { ...Type.label, color: c.text.secondary, marginBottom: 2 },
    fieldHint: { ...Type.caption, color: c.text.tertiary, marginBottom: 7 },
    input: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 13,
      ...Type.bodyMed,
      color: c.text.primary,
    },
    section: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: c.text.primary,
      marginBottom: 10,
      marginTop: 2,
    },
    vitalsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 16,
    },
    vital: { width: "47%", flexGrow: 1 },
    vitalLabel: { ...Type.caption, color: c.text.tertiary, marginBottom: 5 },
    vitalInput: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      ...Type.bodyMed,
      color: c.text.primary,
    },
    footnote: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 12,
    },
    aiCard: {
      backgroundColor: c.tealSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 14,
      marginBottom: 14,
    },
    aiRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    aiTitle: { fontFamily: Fonts.bold, fontSize: 14, color: c.text.primary },
    aiHint: {
      ...Type.caption,
      color: c.text.secondary,
      marginTop: 4,
      marginBottom: 10,
    },
    aiActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    aiBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    aiBtnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    aiBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.primary,
    },
    recDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: "#E5484D",
    },
    aiBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    aiBannerText: { ...Type.caption, color: c.text.secondary, flex: 1 },
    chipsWrap: { marginBottom: 16 },
    chipsTitle: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      color: c.text.primary,
      marginBottom: 8,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: "100%",
    },
    chipDone: { opacity: 0.55 },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 12.5,
      color: c.text.primary,
      flexShrink: 1,
    },
    chipTextDone: { textDecorationLine: "line-through" },
    chipsFootnote: { ...Type.caption, color: c.text.tertiary, marginTop: 8 },
  });
