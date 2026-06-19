import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Palette,
  Fonts,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { Button } from "../../../src/components/common/Button";
import { AppHeader, AnimatedPressable, Card } from "../../../src/components/ui";
import { referralsApi } from "../../../src/api/referrals.api";
import { openReferralPdf } from "../../../src/utils/openPdf";

type Status =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

interface Referral {
  id: string;
  status: Status;
  urgency: "ROUTINE" | "URGENT";
  specialty?: string;
  reason?: string;
  diagnosis?: string;
  clinicalSummary?: string;
  createdAt: string;
  referringDoctor?: { name: string; image?: string };
  specialist?: {
    id: string;
    name: string;
    image?: string;
    designation?: string;
  };
}

const makeStatusMeta = (
  c: Palette,
  t: TFunction,
): Record<Status, { label: string; color: string; bg: string }> => ({
  PENDING: {
    label: t("referrals.statusPending"),
    color: c.tealDeep,
    bg: c.tealSoft,
  },
  ACCEPTED: {
    label: t("referrals.statusAccepted"),
    color: c.tealDeep,
    bg: c.tealSoft,
  },
  DECLINED: {
    label: t("referrals.statusDeclined"),
    color: "#B42318",
    bg: "rgba(217,45,32,0.1)",
  },
  BOOKED: {
    label: t("referrals.statusBooked"),
    color: "#067647",
    bg: "rgba(6,118,71,0.12)",
  },
  COMPLETED: {
    label: t("referrals.statusCompleted"),
    color: "#067647",
    bg: "rgba(6,118,71,0.12)",
  },
  CANCELLED: {
    label: t("referrals.statusCancelled"),
    color: c.text.tertiary,
    bg: c.surfaceAlt,
  },
  EXPIRED: {
    label: t("referrals.statusExpired"),
    color: c.text.tertiary,
    bg: c.surfaceAlt,
  },
});

export default function MyReferralsScreen() {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const STATUS_META = makeStatusMeta(colors, t);

  const load = useCallback(() => {
    referralsApi
      .getMine()
      .then((r: unknown) => setItems((r as { data: Referral[] }).data ?? []))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const bookable = (s: Status) => s === "PENDING" || s === "ACCEPTED";

  const book = (r: Referral) => {
    if (!r.specialist?.id) return;
    router.push({
      pathname: "/(app)/(doctors)/[id]",
      params: { id: r.specialist.id, referralId: r.id },
    });
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title={t("referrals.title")} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.teal}
          />
        }
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="git-network-outline"
                size={40}
                color={colors.teal}
              />
            </View>
            <Text style={styles.emptyTitle}>{t("referrals.emptyTitle")}</Text>
            <Text style={styles.emptyText}>{t("referrals.emptyText")}</Text>
          </View>
        ) : (
          items.map((r) => {
            const m = STATUS_META[r.status];
            return (
              <Card key={r.id} style={styles.card}>
                <View style={styles.head}>
                  <Avatar
                    uri={r.specialist?.image}
                    name={r.specialist?.name}
                    size={44}
                    ring
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specName}>
                      {t("referrals.drName", {
                        name: r.specialist?.name ?? t("referrals.specialist"),
                      })}
                    </Text>
                    <Text style={styles.spec}>
                      {r.specialist?.designation ||
                        r.specialty ||
                        t("referrals.specialist")}
                    </Text>
                  </View>
                  {r.urgency === "URGENT" && bookable(r.status) ? (
                    <View style={styles.urgentTag}>
                      <Ionicons name="alert-circle" size={12} color="#B42318" />
                      <Text style={styles.urgentText}>
                        {t("referrals.urgent")}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusTag, { backgroundColor: m.bg }]}>
                      <Text style={[styles.statusText, { color: m.color }]}>
                        {m.label}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.refLine}>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={colors.text.tertiary}
                  />
                  <Text style={styles.refFrom}>
                    {t("referrals.referredBy", {
                      name: r.referringDoctor?.name ?? "—",
                    })}
                  </Text>
                </View>

                {r.reason ? (
                  <View style={styles.block}>
                    <Text style={styles.blockLabel}>
                      {t("referrals.reason")}
                    </Text>
                    <Text style={styles.blockText}>{r.reason}</Text>
                  </View>
                ) : null}
                {r.clinicalSummary ? (
                  <View style={styles.block}>
                    <Text style={styles.blockLabel}>
                      {t("referrals.clinicalSummary")}
                    </Text>
                    <Text style={styles.blockText}>{r.clinicalSummary}</Text>
                  </View>
                ) : null}

                <AnimatedPressable
                  haptic="light"
                  onPress={() => openReferralPdf(r.id).catch(() => {})}
                  style={styles.letterBtn}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={15}
                    color={colors.tealDeep}
                  />
                  <Text style={styles.letterText}>
                    {t("referrals.viewLetter")}
                  </Text>
                  <Ionicons
                    name="download-outline"
                    size={15}
                    color={colors.text.tertiary}
                  />
                </AnimatedPressable>

                {bookable(r.status) ? (
                  <Button
                    label={t("referrals.bookWith", {
                      name:
                        r.specialist?.name?.split(" ")[0] ??
                        t("referrals.specialistLower"),
                    })}
                    onPress={() => book(r)}
                    style={{ marginTop: 12 }}
                    icon={
                      <Ionicons
                        name="calendar-outline"
                        size={17}
                        color="#fff"
                      />
                    }
                  />
                ) : r.status === "BOOKED" ? (
                  <View style={styles.bookedNote}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#067647"
                    />
                    <Text style={styles.bookedText}>
                      {t("referrals.bookedNote")}
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    card: { marginBottom: 14 },
    head: { flexDirection: "row", alignItems: "center", gap: 12 },
    specName: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: c.text.primary,
      letterSpacing: -0.2,
    },
    spec: { ...Type.caption, color: c.tealDeep, marginTop: 2 },
    urgentTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(217,45,32,0.1)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 14,
    },
    urgentText: { fontFamily: Fonts.bold, fontSize: 11, color: "#B42318" },
    statusTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14 },
    statusText: { fontFamily: Fonts.bold, fontSize: 11 },
    refLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 12,
    },
    refFrom: { ...Type.caption, color: c.text.tertiary },
    block: { marginTop: 12 },
    blockLabel: { ...Type.label, color: c.text.tertiary, marginBottom: 3 },
    blockText: { ...Type.bodySm, color: c.text.secondary, lineHeight: 19 },
    letterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.surfaceAlt,
    },
    letterText: {
      flex: 1,
      ...Type.bodySm,
      color: c.tealDeep,
      fontFamily: Fonts.semibold,
    },
    bookedNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 12,
      backgroundColor: "rgba(6,118,71,0.08)",
      padding: 11,
      borderRadius: Radius.md,
    },
    bookedText: { ...Type.caption, color: "#067647", fontFamily: Fonts.medium },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      paddingHorizontal: 30,
      gap: 12,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.tealSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontFamily: Fonts.bold,
      fontSize: 18,
      color: c.text.primary,
    },
    emptyText: {
      ...Type.body,
      color: c.text.tertiary,
      textAlign: "center",
      lineHeight: 21,
    },
  });
