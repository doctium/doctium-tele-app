import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { Button } from "../../../src/components/common/Button";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AppHeader, Card, Txt } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface RefillReq {
  id: string;
  patientNote: string;
  createdAt: string;
  prescription: {
    id: string;
    code: string;
    diagnosis: string;
    user: { name: string; image?: string };
    subPatient?: { name: string } | null;
    items: { drugName: string; refills: number }[];
  };
}

export default function RefillRequestsScreen() {
  const [list, setList] = useState<RefillReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const load = useCallback(async () => {
    try {
      const r = await doctorApi.getRefillRequests();
      setList((r as { data: RefillReq[] }).data ?? []);
    } catch {
      /* surfaced elsewhere */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const decide = async (
    id: string,
    decision: "APPROVED" | "DECLINED",
    note?: string,
  ) => {
    setBusy(id);
    try {
      await doctorApi.decideRefill(id, decision, note);
      setList((l) => l.filter((r) => r.id !== id));
    } catch {
      /* surfaced elsewhere */
    } finally {
      setBusy(null);
    }
  };

  const approve = (id: string) =>
    Alert.alert(
      "Approve refill",
      "Approve this refill request? One authorised refill will be consumed per medication.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", onPress: () => decide(id, "APPROVED") },
      ],
    );

  const confirmDecline = async () => {
    if (!declineFor) return;
    const id = declineFor;
    const note = declineNote.trim();
    setDeclineFor(null);
    setDeclineNote("");
    await decide(id, "DECLINED", note);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <View style={styles.root}>
      <AppHeader title="Refill requests" />
      {!loading && list.length === 0 ? (
        <EmptyState
          icon="repeat-outline"
          title="No pending requests"
          description="Refill requests from your patients will appear here for approval."
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
          renderItem={({ item }) => {
            const p = item.prescription;
            const name = p.subPatient?.name || p.user.name;
            const first = p.items[0]?.drugName ?? "Medication";
            const more =
              p.items.length > 1 ? ` +${p.items.length - 1} more` : "";
            return (
              <Card style={styles.card}>
                <View style={styles.top}>
                  <Avatar uri={p.user.image} name={name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.meds} numberOfLines={1}>
                      {first}
                      {more}
                    </Text>
                  </View>
                  <Text style={styles.date}>{fmt(item.createdAt)}</Text>
                </View>
                {item.patientNote ? (
                  <Text style={styles.note}>“{item.patientNote}”</Text>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label="Decline"
                    variant="outline"
                    size="sm"
                    onPress={() => setDeclineFor(item.id)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Approve"
                    size="sm"
                    loading={busy === item.id}
                    onPress={() => approve(item.id)}
                    style={{ flex: 1 }}
                    icon={<Ionicons name="checkmark" size={16} color="#fff" />}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}

      <Modal
        visible={!!declineFor}
        transparent
        animationType="slide"
        onRequestClose={() => setDeclineFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h3" style={{ marginBottom: 14 }}>
              Decline refill
            </Txt>
            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Please book a follow-up first"
              placeholderTextColor={colors.text.tertiary}
              value={declineNote}
              onChangeText={setDeclineNote}
              multiline
            />
            <View style={styles.sheetBtns}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setDeclineFor(null);
                  setDeclineNote("");
                }}
                style={{ flex: 1 }}
              />
              <Button
                label="Decline"
                variant="secondary"
                onPress={confirmDecline}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    list: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 40 },
    card: { marginBottom: 12 },
    top: { flexDirection: "row", alignItems: "center", gap: 12 },
    name: {
      ...Type.bodyMed,
      color: c.text.primary,
      fontFamily: Fonts.bold,
    },
    meds: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    date: { ...Type.caption, color: c.text.tertiary },
    note: {
      ...Type.bodySm,
      color: c.text.secondary,
      fontStyle: "italic",
      marginTop: 12,
      backgroundColor: c.surfaceAlt,
      padding: 12,
      borderRadius: Radius.md,
    },
    actions: { flexDirection: "row", gap: 12, marginTop: 14 },
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
    fieldLabel: {
      ...Type.label,
      color: c.text.secondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 14,
      ...Type.bodyMed,
      color: c.text.primary,
      minHeight: 80,
      textAlignVertical: "top",
      marginBottom: 16,
    },
    sheetBtns: { flexDirection: "row", gap: 12 },
  });
