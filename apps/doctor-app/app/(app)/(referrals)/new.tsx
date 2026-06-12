import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { Button } from "../../../src/components/common/Button";
import { AppHeader, AnimatedPressable, Card } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface Specialist {
  id: string;
  name: string;
  image?: string;
  designation?: string;
  clinicName?: string;
}

export default function NewReferralScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // specialty/reason arrive pre-seeded from the scribe's suggested-referral chip
  const {
    appointmentId,
    specialty,
    reason: suggestedReason,
  } = useLocalSearchParams<{
    appointmentId: string;
    specialty?: string;
    reason?: string;
  }>();
  const [query, setQuery] = useState(specialty ?? "");
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [picked, setPicked] = useState<Specialist | null>(null);
  const [reason, setReason] = useState(suggestedReason ?? "");
  const [diagnosis, setDiagnosis] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(
      () => {
        doctorApi
          .listSpecialists(query.trim() || undefined)
          .then((r: unknown) =>
            setSpecialists((r as { data: Specialist[] }).data ?? []),
          )
          .catch(() => {})
          .finally(() => setLoading(false));
      },
      query ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [query]);

  // Prefill the diagnosis from the consult's SOAP assessment, if one exists.
  useEffect(() => {
    if (!appointmentId) return;
    doctorApi
      .getClinicalNote(appointmentId)
      .then((r: unknown) => {
        const a = (r as { data: { assessment?: string } | null }).data
          ?.assessment;
        if (a) setDiagnosis(a);
      })
      .catch(() => {});
  }, [appointmentId]);

  const send = async () => {
    if (!picked || !appointmentId) return;
    setSending(true);
    try {
      await doctorApi.createReferral({
        sourceAppointmentId: appointmentId,
        specialistId: picked.id,
        reason: reason.trim(),
        diagnosis: diagnosis.trim(),
        urgency: urgent ? "URGENT" : "ROUTINE",
      });
      setDone(true);
      setTimeout(() => router.back(), 1300);
    } catch {
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <View style={styles.root}>
        <AppHeader title="Refer to specialist" />
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={48} color={colors.teal} />
          <Text style={styles.doneText}>
            Referral sent. The patient and Dr. {picked?.name} have been
            notified.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title="Refer to specialist" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {picked ? (
            <Card style={styles.pickedCard}>
              <Avatar uri={picked.image} name={picked.name} size={44} ring />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickedName}>Dr. {picked.name}</Text>
                <Text style={styles.pickedSpec}>
                  {picked.designation || "Specialist"}
                  {picked.clinicName ? ` · ${picked.clinicName}` : ""}
                </Text>
              </View>
              <AnimatedPressable
                haptic="light"
                onPress={() => setPicked(null)}
                style={styles.changeBtn}
              >
                <Text style={styles.changeText}>Change</Text>
              </AnimatedPressable>
            </Card>
          ) : (
            <>
              <Text style={styles.label}>Choose a specialist</Text>
              <View style={styles.search}>
                <Ionicons
                  name="search"
                  size={16}
                  color={colors.text.tertiary}
                />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by specialty (e.g. Cardiology)"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              {loading ? (
                <ActivityIndicator
                  color={colors.teal}
                  style={{ marginTop: 24 }}
                />
              ) : specialists.length === 0 ? (
                <Text style={styles.empty}>No specialists found.</Text>
              ) : (
                specialists.map((s) => (
                  <AnimatedPressable
                    key={s.id}
                    haptic="light"
                    onPress={() => setPicked(s)}
                    style={styles.specRow}
                  >
                    <Avatar uri={s.image} name={s.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.specName}>Dr. {s.name}</Text>
                      <Text style={styles.specDesig}>
                        {s.designation || "Specialist"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color={colors.text.tertiary}
                    />
                  </AnimatedPressable>
                ))
              )}
            </>
          )}

          {picked && (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.label}>Reason for referral</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Palpitations — needs ECG & cardiology review"
                placeholderTextColor={colors.text.tertiary}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.label}>Working diagnosis</Text>
              <TextInput
                style={styles.input}
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder="e.g. ?Arrhythmia"
                placeholderTextColor={colors.text.tertiary}
              />
              <Text style={styles.label}>Urgency</Text>
              <View style={styles.urgRow}>
                {[
                  { v: false, label: "Routine", icon: "time-outline" as const },
                  {
                    v: true,
                    label: "Urgent",
                    icon: "alert-circle-outline" as const,
                  },
                ].map((o) => {
                  const active = urgent === o.v;
                  return (
                    <AnimatedPressable
                      key={o.label}
                      haptic="light"
                      onPress={() => setUrgent(o.v)}
                      style={[
                        styles.urgChip,
                        active &&
                          (o.v ? styles.urgActiveRed : styles.urgActive),
                      ]}
                    >
                      <Ionicons
                        name={o.icon}
                        size={15}
                        color={active ? "#fff" : colors.text.secondary}
                      />
                      <Text
                        style={[styles.urgText, active && { color: "#fff" }]}
                      >
                        {o.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              <View style={styles.note}>
                <Ionicons
                  name="document-attach-outline"
                  size={15}
                  color={colors.tealDeep}
                />
                <Text style={styles.noteText}>
                  The patient's allergies, active conditions and your consult
                  notes are attached automatically.
                </Text>
              </View>

              <Button
                label="Send referral"
                onPress={send}
                loading={sending}
                disabled={!reason.trim()}
                style={{ marginTop: 8 }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 30,
    },
    doneText: {
      ...Type.body,
      color: c.text.secondary,
      textAlign: "center",
    },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 50, paddingTop: 4 },
    label: {
      ...Type.label,
      color: c.text.secondary,
      marginBottom: 9,
      marginTop: 14,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    searchInput: {
      flex: 1,
      ...Type.bodyMed,
      color: c.text.primary,
      padding: 0,
    },
    empty: {
      ...Type.body,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 24,
    },
    specRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    specName: {
      fontFamily: Fonts.semibold,
      fontSize: 15,
      color: c.text.primary,
    },
    specDesig: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    pickedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 4,
    },
    pickedName: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: c.text.primary,
    },
    pickedSpec: { ...Type.caption, color: c.tealDeep, marginTop: 2 },
    changeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
    },
    changeText: {
      fontFamily: Fonts.semibold,
      fontSize: 12.5,
      color: c.text.secondary,
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 13,
      ...Type.bodyMed,
      color: c.text.primary,
    },
    urgRow: { flexDirection: "row", gap: 10 },
    urgChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    urgActive: { backgroundColor: c.teal, borderColor: c.teal },
    urgActiveRed: { backgroundColor: "#D92D20", borderColor: "#D92D20" },
    urgText: {
      fontFamily: Fonts.semibold,
      fontSize: 13.5,
      color: c.text.secondary,
    },
    note: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      backgroundColor: c.tealSoft,
      borderRadius: Radius.md,
      padding: 11,
      marginTop: 16,
    },
    noteText: {
      flex: 1,
      ...Type.caption,
      color: c.tealDeep,
      lineHeight: 16,
    },
  });
