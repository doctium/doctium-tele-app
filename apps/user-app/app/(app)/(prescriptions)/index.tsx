import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Palette,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { Badge } from "../../../src/components/common/Badge";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AppHeader, AnimatedPressable } from "../../../src/components/ui";
import { prescriptionsApi } from "../../../src/api/prescriptions.api";

interface Rx {
  id: string;
  code: string;
  status: "ISSUED" | "DISPENSED" | "CANCELLED";
  signedAt: string;
  diagnosis: string;
  doctor?: { name: string; image?: string; designation?: string };
  subPatient?: { name: string } | null;
  items: { id: string }[];
}

const STATUS: Record<
  Rx["status"],
  { variant: "confirmed" | "completed" | "cancelled"; label: string }
> = {
  ISSUED: { variant: "confirmed", label: "Active" },
  DISPENSED: { variant: "completed", label: "Dispensed" },
  CANCELLED: { variant: "cancelled", label: "Cancelled" },
};

export default function PrescriptionsScreen() {
  const [list, setList] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const load = useCallback(async () => {
    try {
      const r = await prescriptionsApi.getMine();
      setList((r as { data: Rx[] }).data ?? []);
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

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <View style={styles.root}>
      <AppHeader title="Prescriptions" />
      {!loading && list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No prescriptions yet"
          description="Prescriptions issued by your doctor after a consultation will appear here."
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
            const s = STATUS[item.status];
            return (
              <AnimatedPressable
                haptic="light"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(prescriptions)/[id]",
                    params: { id: item.id },
                  })
                }
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Avatar
                    uri={item.doctor?.image}
                    name={item.doctor?.name}
                    size={44}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName} numberOfLines={1}>
                      Dr. {item.doctor?.name ?? "Doctor"}
                    </Text>
                    <Text style={styles.docSpec} numberOfLines={1}>
                      {item.doctor?.designation || "General practitioner"}
                    </Text>
                  </View>
                  <Badge variant={s.variant} label={s.label} />
                </View>
                <View style={styles.divider} />
                <View style={styles.cardBottom}>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="medkit-outline"
                      size={15}
                      color={colors.tealDeep}
                    />
                    <Text style={styles.metaText}>
                      {item.items.length} medication
                      {item.items.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.metaText}>{fmt(item.signedAt)}</Text>
                  </View>
                  {item.subPatient ? (
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="person-outline"
                        size={15}
                        color={colors.text.tertiary}
                      />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.subPatient.name}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </AnimatedPressable>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    list: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 40 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    docName: {
      ...Type.bodyMed,
      color: c.text.primary,
      fontFamily: Fonts.bold,
    },
    docSpec: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 12,
    },
    cardBottom: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 16,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { ...Type.caption, color: c.text.secondary, maxWidth: 130 },
  });
