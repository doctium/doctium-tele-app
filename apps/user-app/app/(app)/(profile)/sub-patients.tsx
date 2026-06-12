import React, { useEffect, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useThemedStyles,
} from "../../../src/theme";
import { Input } from "../../../src/components/common/Input";
import { Button } from "../../../src/components/common/Button";
import { Avatar } from "../../../src/components/common/Avatar";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchSubPatients } from "../../../src/store/slices/userSlice";
import { usersApi } from "../../../src/api/users.api";

interface SubPatient {
  id: string;
  name: string;
  relation: string;
  age?: number;
  gender: string;
}

export default function SubPatientsScreen() {
  const dispatch = useAppDispatch();
  const styles = useThemedStyles(makeStyles);
  const { subPatients } = useAppSelector((s) => s.user);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    relation: "",
    age: "",
    gender: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchSubPatients());
  }, []);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = async () => {
    setLoading(true);
    try {
      await usersApi.createSubPatient({
        ...form,
        age: form.age ? parseInt(form.age, 10) : undefined,
      });
      dispatch(fetchSubPatients());
      setShowAdd(false);
      setForm({ name: "", relation: "", age: "", gender: "" });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Family members"
        right={
          <AnimatedPressable
            haptic="light"
            onPress={() => setShowAdd(true)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </AnimatedPressable>
        }
      />

      <FlatList
        data={subPatients as SubPatient[]}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ marginTop: 60 }}>
            <EmptyState
              icon="people-outline"
              title="No family members"
              description="Add family members to book appointments on their behalf."
              actionLabel="Add member"
              onAction={() => setShowAdd(true)}
            />
          </View>
        }
        renderItem={({ item: p }) => (
          <View style={styles.card}>
            <Avatar name={p.name} size={50} ring />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.gender}
                {p.age ? ` · ${p.age} yrs` : ""}
              </Text>
            </View>
            <View style={styles.relPill}>
              <Text style={styles.relText}>{p.relation}</Text>
            </View>
          </View>
        )}
      />

      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 18 }}>
              Add family member
            </Txt>
            <Input
              label="Full name"
              value={form.name}
              onChangeText={set("name")}
              placeholder="e.g. Chidi Nwosu"
            />
            <Input
              label="Relationship"
              value={form.relation}
              onChangeText={set("relation")}
              placeholder="e.g. Son, Mother, Spouse"
            />
            <Input
              label="Age"
              value={form.age}
              onChangeText={set("age")}
              placeholder="Age in years"
              keyboardType="number-pad"
            />
            <Input
              label="Gender"
              value={form.gender}
              onChangeText={set("gender")}
              placeholder="Male / Female"
            />
            <View style={styles.sheetBtns}>
              <Button
                label="Cancel"
                onPress={() => setShowAdd(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Add"
                onPress={handleAdd}
                loading={loading}
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
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.cta,
    },
    list: { paddingHorizontal: Space.xl, paddingTop: 6, gap: 12 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    name: { ...Type.title, color: c.text.primary },
    meta: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    relPill: {
      backgroundColor: c.tealSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.round,
    },
    relText: { fontFamily: Fonts.semibold, fontSize: 12, color: c.tealDeep },
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
    sheetBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  });
