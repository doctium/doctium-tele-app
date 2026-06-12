import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import { Button } from "../../../src/components/common/Button";
import { Input } from "../../../src/components/common/Input";
import {
  AppHeader,
  Card,
  Txt,
  AnimatedPressable,
} from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface Med {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  refills: string;
  instructions: string;
}
const emptyMed = (): Med => ({
  drugName: "",
  dosage: "",
  frequency: "",
  duration: "",
  refills: "0",
  instructions: "",
});

export default function CreatePrescriptionScreen() {
  const { appointmentId, prefill } = useLocalSearchParams<{
    appointmentId: string;
    prefill?: string;
  }>();

  // Scribe action hub: arrive with AI-suggested items pre-filled. The doctor
  // still reviews, edits and explicitly issues — nothing is auto-submitted.
  const seeded = (() => {
    if (!prefill) return null;
    try {
      const p = JSON.parse(prefill) as {
        diagnosis?: string;
        items?: Partial<Med & { refills: number }>[];
      };
      const items = (p.items ?? [])
        .filter((it) => (it.drugName ?? "").trim())
        .map((it) => ({
          drugName: String(it.drugName ?? ""),
          dosage: String(it.dosage ?? ""),
          frequency: String(it.frequency ?? ""),
          duration: String(it.duration ?? ""),
          refills: "0",
          instructions: String(it.instructions ?? ""),
        }));
      return {
        diagnosis: String(p.diagnosis ?? ""),
        items: items.length ? items : null,
      };
    } catch {
      return null;
    }
  })();

  const [meds, setMeds] = useState<Med[]>(seeded?.items ?? [emptyMed()]);
  const [diagnosis, setDiagnosis] = useState(seeded?.diagnosis ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const update = (i: number, field: keyof Med, v: string) =>
    setMeds((m) =>
      m.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)),
    );
  const addMed = () => setMeds((m) => [...m, emptyMed()]);
  const removeMed = (i: number) =>
    setMeds((m) => (m.length === 1 ? m : m.filter((_, idx) => idx !== i)));

  const submit = async () => {
    const items = meds
      .filter((m) => m.drugName.trim())
      .map((m) => ({
        drugName: m.drugName.trim(),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
        refills: parseInt(m.refills, 10) || 0,
        instructions: m.instructions.trim(),
      }));
    if (!items.length) {
      setError("Add at least one medication.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await doctorApi.createPrescription({
        appointmentId,
        diagnosis: diagnosis.trim(),
        notes: notes.trim(),
        items,
      });
      router.back();
    } catch (e) {
      setError(
        (e as { message?: string })?.message ?? "Could not issue prescription.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Write prescription" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <Txt variant="h3" style={styles.title}>
              Diagnosis
            </Txt>
            <Input
              placeholder="e.g. Acute bronchitis"
              value={diagnosis}
              onChangeText={setDiagnosis}
              containerStyle={{ marginBottom: 0 }}
            />
          </Card>

          <View style={styles.medHeader}>
            <Text style={styles.medHeaderTxt}>℞ Medications</Text>
            <Text style={styles.medCount}>{meds.length}</Text>
          </View>

          {meds.map((med, i) => (
            <Card key={i} style={styles.card}>
              <View style={styles.medTop}>
                <Text style={styles.medIndex}>Medication {i + 1}</Text>
                {meds.length > 1 ? (
                  <AnimatedPressable
                    haptic="light"
                    onPress={() => removeMed(i)}
                    style={styles.removeBtn}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.error}
                    />
                  </AnimatedPressable>
                ) : null}
              </View>
              <Input
                label="Drug name"
                placeholder="e.g. Amoxicillin"
                value={med.drugName}
                onChangeText={(v) => update(i, "drugName", v)}
              />
              <View style={styles.row}>
                <Input
                  label="Dosage"
                  placeholder="500mg"
                  value={med.dosage}
                  onChangeText={(v) => update(i, "dosage", v)}
                  containerStyle={styles.half}
                />
                <Input
                  label="Frequency"
                  placeholder="3x daily"
                  value={med.frequency}
                  onChangeText={(v) => update(i, "frequency", v)}
                  containerStyle={styles.half}
                />
              </View>
              <View style={styles.row}>
                <Input
                  label="Duration"
                  placeholder="7 days"
                  value={med.duration}
                  onChangeText={(v) => update(i, "duration", v)}
                  containerStyle={styles.half}
                />
                <Input
                  label="Refills"
                  placeholder="0"
                  value={med.refills}
                  onChangeText={(v) =>
                    update(i, "refills", v.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="number-pad"
                  containerStyle={styles.half}
                />
              </View>
              <Input
                label="Instructions (optional)"
                placeholder="Take with food"
                value={med.instructions}
                onChangeText={(v) => update(i, "instructions", v)}
                containerStyle={{ marginBottom: 0 }}
              />
            </Card>
          ))}

          <AnimatedPressable
            haptic="light"
            onPress={addMed}
            style={styles.addRow}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.navy} />
            <Text style={styles.addTxt}>Add another medication</Text>
          </AnimatedPressable>

          <Card style={styles.card}>
            <Txt variant="h3" style={styles.title}>
              Notes for patient
            </Txt>
            <Input
              placeholder="e.g. Rest, drink fluids, return if symptoms persist"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              containerStyle={{ marginBottom: 0 }}
              style={styles.multiline}
            />
          </Card>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Issue prescription"
            onPress={submit}
            loading={loading}
            icon={<Ionicons name="shield-checkmark" size={18} color="#fff" />}
            style={{ marginTop: 6 }}
          />
          <Text style={styles.hint}>
            The prescription is digitally signed and a verifiable PDF is
            generated.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 48, paddingTop: 4 },
    card: { marginBottom: 14 },
    title: { marginBottom: 12 },
    medHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      marginTop: 4,
      paddingHorizontal: 2,
    },
    medHeaderTxt: { ...Type.h3, color: c.navy },
    medCount: {
      ...Type.caption,
      color: c.tealDeep,
      backgroundColor: c.tealSoft,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: Radius.round,
      overflow: "hidden",
      fontFamily: Fonts.bold,
    },
    medTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    medIndex: { ...Type.label, color: c.text.secondary },
    removeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.errorSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    row: { flexDirection: "row", gap: 12 },
    half: { flex: 1 },
    multiline: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      marginBottom: 14,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: c.navy,
      borderStyle: "dashed",
    },
    addTxt: { ...Type.bodyMed, color: c.navy, fontFamily: Fonts.bold },
    error: {
      ...Type.bodySm,
      color: c.error,
      marginBottom: 10,
      textAlign: "center",
    },
    hint: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 12,
    },
  });
