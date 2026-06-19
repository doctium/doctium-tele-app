import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AppHeader } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { notificationsApi } from "../../../src/api/notifications.api";

interface Notification {
  id: string;
  title: string;
  message: string;
  stateType?: number;
  date: string;
  createdAt: string;
}

const makeMeta = (
  c: Palette,
): Record<
  number,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> => ({
  1: { icon: "calendar", color: c.skyDeep, bg: c.skySoft },
  2: { icon: "notifications", color: c.navyMid, bg: c.navySoft },
  3: {
    icon: "checkmark-circle",
    color: c.success,
    bg: c.successSoft,
  },
  4: { icon: "close-circle", color: c.error, bg: c.errorSoft },
  5: { icon: "ban", color: c.error, bg: c.errorSoft },
});

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const META = makeMeta(colors);

  useEffect(() => {
    notificationsApi
      .getAll()
      .then((r: unknown) =>
        setNotifications((r as { data: Notification[] }).data ?? []),
      )
      .catch(() => {});
  }, []);

  return (
    <View style={styles.root}>
      <AppHeader title={t("notifications.title")} />
      {notifications.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="notifications-outline"
            title={t("notifications.emptyTitle")}
            description={t("notifications.emptyDesc")}
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const m = META[item.stateType ?? 2] ?? META[2]!;
            return (
              <View style={styles.card}>
                <View style={[styles.iconBox, { backgroundColor: m.bg }]}>
                  <Ionicons name={m.icon} size={20} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.msg}>{item.message}</Text>
                  <Text style={styles.time}>
                    {new Date(item.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>
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
    list: { paddingHorizontal: Space.xl, paddingTop: 6, gap: 12 },
    card: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { ...Type.title, color: c.text.primary },
    msg: { ...Type.bodySm, color: c.text.secondary, marginTop: 3 },
    time: { ...Type.caption, color: c.text.tertiary, marginTop: 7 },
  });
