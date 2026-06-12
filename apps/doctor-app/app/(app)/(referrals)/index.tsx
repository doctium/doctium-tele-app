import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { formatMoney } from "../../../src/utils/money";
import { Avatar } from "../../../src/components/common/Avatar";
import { Button } from "../../../src/components/common/Button";
import {
  AppHeader,
  AnimatedPressable,
  Card,
  Txt,
} from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";
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
  commissionPct?: number;
  commissionAmount?: number;
  createdAt: string;
  referringDoctor?: { name: string; image?: string; designation?: string };
  specialist?: { name: string; image?: string; designation?: string };
  user?: { name: string; image?: string };
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  booked: number;
  completed: number;
  conversionRate: number;
}

const makeStatusMeta = (
  c: Palette,
): Record<Status, { label: string; color: string; bg: string }> => ({
  PENDING: { label: "Awaiting", color: "#B54708", bg: "rgba(247,144,9,0.13)" },
  ACCEPTED: { label: "Accepted", color: c.tealDeep, bg: c.tealSoft },
  DECLINED: { label: "Declined", color: "#B42318", bg: "rgba(217,45,32,0.1)" },
  BOOKED: { label: "Booked", color: "#067647", bg: "rgba(6,118,71,0.12)" },
  COMPLETED: {
    label: "Completed",
    color: "#067647",
    bg: "rgba(6,118,71,0.12)",
  },
  CANCELLED: {
    label: "Cancelled",
    color: c.text.tertiary,
    bg: c.surfaceAlt,
  },
  EXPIRED: {
    label: "Expired",
    color: c.text.tertiary,
    bg: c.surfaceAlt,
  },
});

export default function ReferralsScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const STATUS_META = makeStatusMeta(colors);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [received, setReceived] = useState<Referral[]>([]);
  const [sent, setSent] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [acceptOf, setAcceptOf] = useState<Referral | null>(null);
  const [commPct, setCommPct] = useState(0);

  const load = useCallback(() => {
    Promise.all([
      doctorApi
        .getReceivedReferrals()
        .then((r: unknown) =>
          setReceived((r as { data: Referral[] }).data ?? []),
        ),
      doctorApi
        .getSentReferrals()
        .then((r: unknown) => setSent((r as { data: Referral[] }).data ?? [])),
      doctorApi
        .getReferralStats()
        .then((r: unknown) => setStats((r as { data: Stats }).data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const decline = async (id: string) => {
    setBusy(id);
    try {
      await doctorApi.respondReferral(id, false);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const confirmAccept = async () => {
    if (!acceptOf) return;
    setBusy(acceptOf.id);
    try {
      await doctorApi.respondReferral(acceptOf.id, true, {
        commissionPct: commPct || undefined,
      });
      setAcceptOf(null);
      setCommPct(0);
      load();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const list = tab === "received" ? received : sent;

  return (
    <View style={styles.root}>
      <AppHeader title="Referrals" />

      <View style={styles.tabs}>
        {(["received", "sent"] as const).map((t) => (
          <AnimatedPressable
            key={t}
            haptic="light"
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "received" ? "Received" : "Sent"}
            </Text>
            {t === "received" &&
            received.filter((r) => r.status === "PENDING").length > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {received.filter((r) => r.status === "PENDING").length}
                </Text>
              </View>
            ) : null}
          </AnimatedPressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {tab === "sent" && stats ? (
            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <Stat label="Sent" value={stats.total} />
                <Stat label="Booked" value={stats.booked + stats.completed} />
                <Stat
                  label="Converted"
                  value={`${stats.conversionRate}%`}
                  highlight
                />
              </View>
            </Card>
          ) : null}

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="git-network-outline"
                size={40}
                color={colors.text.tertiary}
              />
              <Text style={styles.emptyText}>
                {tab === "received"
                  ? "No referrals sent to you yet."
                  : "You haven't referred any patients yet."}
              </Text>
            </View>
          ) : (
            list.map((r) => {
              const counterpart =
                tab === "received" ? r.referringDoctor : r.specialist;
              const m = STATUS_META[r.status];
              return (
                <Card key={r.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Avatar uri={r.user?.image} name={r.user?.name} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.patient}>
                        {r.user?.name ?? "Patient"}
                      </Text>
                      <Text style={styles.counterpart}>
                        {tab === "received" ? "from" : "to"} Dr.{" "}
                        {counterpart?.name ?? "—"}
                        {tab === "received" && counterpart?.designation
                          ? ` · ${counterpart.designation}`
                          : ""}
                        {tab === "sent" && r.specialty
                          ? ` · ${r.specialty}`
                          : ""}
                      </Text>
                    </View>
                    {r.urgency === "URGENT" && r.status === "PENDING" ? (
                      <View style={styles.urgentTag}>
                        <Ionicons
                          name="alert-circle"
                          size={12}
                          color="#B42318"
                        />
                        <Text style={styles.urgentText}>Urgent</Text>
                      </View>
                    ) : (
                      <View
                        style={[styles.statusTag, { backgroundColor: m.bg }]}
                      >
                        <Text style={[styles.statusText, { color: m.color }]}>
                          {m.label}
                        </Text>
                      </View>
                    )}
                  </View>

                  {r.reason ? (
                    <Text style={styles.reason}>{r.reason}</Text>
                  ) : null}
                  {tab === "received" && r.clinicalSummary ? (
                    <Text style={styles.summary} numberOfLines={3}>
                      {r.clinicalSummary}
                    </Text>
                  ) : null}

                  {/* Commission line */}
                  {(r.commissionAmount ?? 0) > 0 ? (
                    <View style={styles.commLine}>
                      <Ionicons
                        name="cash-outline"
                        size={13}
                        color={colors.tealDeep}
                      />
                      <Text style={styles.commText}>
                        {tab === "sent" ? "You earned" : "You paid"}{" "}
                        {formatMoney(r.commissionAmount ?? 0)} referral
                        commission
                      </Text>
                    </View>
                  ) : (r.commissionPct ?? 0) > 0 ? (
                    <View style={styles.commLine}>
                      <Ionicons
                        name="cash-outline"
                        size={13}
                        color={colors.text.tertiary}
                      />
                      <Text
                        style={[
                          styles.commText,
                          { color: colors.text.tertiary },
                        ]}
                      >
                        {tab === "received" ? "You offered" : "Commission"}{" "}
                        {r.commissionPct}% of your fee
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFoot}>
                    <AnimatedPressable
                      haptic="light"
                      onPress={() => openReferralPdf(r.id).catch(() => {})}
                      style={styles.letterBtn}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color={colors.tealDeep}
                      />
                      <Text style={styles.letterText}>Letter</Text>
                    </AnimatedPressable>
                    {tab === "received" && r.status === "PENDING" ? (
                      <View style={styles.actions}>
                        <Button
                          label="Decline"
                          variant="outline"
                          style={{ flex: 1 }}
                          loading={busy === r.id}
                          onPress={() => decline(r.id)}
                        />
                        <Button
                          label="Accept"
                          style={{ flex: 1 }}
                          loading={busy === r.id}
                          onPress={() => {
                            setCommPct(r.commissionPct ?? 0);
                            setAcceptOf(r);
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Accept + optional referral commission */}
      <Modal
        visible={!!acceptOf}
        animationType="slide"
        transparent
        onRequestClose={() => setAcceptOf(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAcceptOf(null)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Txt variant="h2" style={{ marginBottom: 4 }}>
            Accept referral
          </Txt>
          <Text style={styles.sheetHint}>
            Optionally thank the referring doctor with a commission — paid from
            your earning on this consult, not the patient.
          </Text>
          <Text style={styles.sheetLabel}>Referral commission</Text>
          <View style={styles.commChips}>
            {[0, 5, 10, 15, 20].map((p) => {
              const active = commPct === p;
              return (
                <AnimatedPressable
                  key={p}
                  haptic="light"
                  onPress={() => setCommPct(p)}
                  style={[styles.commChip, active && styles.commChipActive]}
                >
                  <Text
                    style={[styles.commChipText, active && { color: "#fff" }]}
                  >
                    {p === 0 ? "None" : `${p}%`}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Button
            label={
              commPct > 0
                ? `Accept with ${commPct}% commission`
                : "Accept referral"
            }
            onPress={confirmAccept}
            loading={!!busy}
            style={{ marginTop: 6 }}
          />
        </View>
      </Modal>
    </View>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && { color: colors.tealDeep }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    tabs: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: Space.xl,
      marginBottom: 8,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 9,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
    },
    tabActive: { backgroundColor: c.navy },
    tabText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: c.text.secondary,
    },
    tabTextActive: { color: "#fff" },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#D92D20",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    badgeText: { fontFamily: Fonts.bold, fontSize: 11, color: "#fff" },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    statsCard: { marginBottom: 14 },
    statsRow: { flexDirection: "row" },
    stat: { flex: 1, alignItems: "center" },
    statValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 22,
      color: c.text.primary,
      letterSpacing: -0.5,
    },
    statLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    card: { marginBottom: 14 },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 11 },
    patient: {
      fontFamily: Fonts.bold,
      fontSize: 15.5,
      color: c.text.primary,
    },
    counterpart: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
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
    reason: {
      ...Type.bodySm,
      color: c.text.primary,
      marginTop: 11,
      lineHeight: 19,
    },
    summary: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 6,
      lineHeight: 17,
      fontStyle: "italic",
    },
    actions: { flexDirection: "row", gap: 10, flex: 1 },
    commLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
    },
    commText: {
      ...Type.caption,
      color: c.tealDeep,
      fontFamily: Fonts.medium,
    },
    cardFoot: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    },
    letterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.surfaceAlt,
    },
    letterText: {
      fontFamily: Fonts.semibold,
      fontSize: 12.5,
      color: c.tealDeep,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 70,
      gap: 12,
      paddingHorizontal: 30,
    },
    emptyText: {
      ...Type.body,
      color: c.text.tertiary,
      textAlign: "center",
    },
    backdrop: { flex: 1, backgroundColor: "rgba(8,18,32,0.45)" },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
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
      marginBottom: 16,
    },
    sheetHint: {
      ...Type.caption,
      color: c.text.tertiary,
      marginBottom: 18,
      lineHeight: 17,
    },
    sheetLabel: { ...Type.label, color: c.text.secondary, marginBottom: 9 },
    commChips: { flexDirection: "row", gap: 8, marginBottom: 6 },
    commChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 11,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    commChipActive: { backgroundColor: c.teal, borderColor: c.teal },
    commChipText: {
      fontFamily: Fonts.semibold,
      fontSize: 13.5,
      color: c.text.secondary,
    },
  });
