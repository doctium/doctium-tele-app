import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  Gradients,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { Badge } from "../../../src/components/common/Badge";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { doctorApi } from "../../../src/api/doctor.api";
import { formatMoney, toStoredAmount } from "../../../src/utils/money";

interface Wallet {
  balance: number;
  total: number;
}
interface WithdrawRequest {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  payDate?: string;
  declineReason?: string;
  paymentDetails?: {
    accountNumber?: string;
    bankName?: string;
    accountName?: string;
  } | null;
}
interface Bank {
  name: string;
  code: string;
}
interface DayEarning {
  date: string;
  label: string;
  amount: number;
}
interface EarningsStats {
  currency: string;
  availableBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  completedConsultations: number;
  earnings: { today: number; week: number; month: number };
  last7Days: DayEarning[];
}
type Period = "today" | "week" | "month";

export default function EarningsScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [selectedDay, setSelectedDay] = useState(6); // default to today (last bar)
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Bank / payout destination
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  const load = () => {
    doctorApi
      .getWallet()
      .then((r: unknown) => setWallet((r as { data: Wallet }).data))
      .catch(() => {});
    doctorApi
      .getEarningsStats()
      .then((r: unknown) => setStats((r as { data: EarningsStats }).data))
      .catch(() => {});
    doctorApi
      .getWithdrawRequests()
      .then((r: unknown) =>
        setRequests((r as { data: WithdrawRequest[] }).data ?? []),
      )
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  // Lazy-load the bank list the first time the sheet opens.
  const openWithdraw = () => {
    setShowWithdraw(true);
    if (!banks.length)
      doctorApi
        .getBanks()
        .then((r: unknown) => setBanks((r as { data: Bank[] }).data ?? []))
        .catch(() => {});
  };

  // Resolve the account name once we have a bank + a full account number.
  useEffect(() => {
    setAccountName("");
    if (!bank || accountNumber.length !== 10) return;
    let cancelled = false;
    setResolving(true);
    doctorApi
      .resolveAccount(accountNumber, bank.code)
      .then((r: unknown) => {
        if (!cancelled)
          setAccountName(
            (r as { data: { account_name: string } }).data?.account_name ?? "",
          );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bank, accountNumber]);

  // The doctor enters naira; balance + withdrawal API are in kobo.
  const valKobo = toStoredAmount(parseFloat(amount) || 0);
  const canSubmit =
    valKobo > 0 &&
    valKobo <= (wallet?.balance ?? 0) &&
    !!bank &&
    accountNumber.length === 10;

  const handleWithdraw = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await doctorApi.requestWithdrawal({
        amount: valKobo,
        bankDetails: {
          accountNumber,
          bankCode: bank!.code,
          bankName: bank!.name,
          accountName,
        },
      });
      load();
      setShowWithdraw(false);
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      setBank(null);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const statusVariant = (s: string): "pending" | "completed" | "cancelled" =>
    s === "ACCEPTED" ? "completed" : s === "DECLINED" ? "cancelled" : "pending";
  const filteredBanks = bankSearch
    ? banks.filter((b) =>
        b.name.toLowerCase().includes(bankSearch.toLowerCase()),
      )
    : banks;
  const avgPerConsult =
    stats && stats.completedConsultations > 0
      ? Math.round(stats.totalEarnings / stats.completedConsultations)
      : 0;
  const days = stats?.last7Days ?? [];
  const maxDay = Math.max(...days.map((d) => d.amount), 1);
  const selDay = days[selectedDay];

  return (
    <View style={styles.root}>
      <AppHeader title="Earnings & wallet" />
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={Gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardBlob} />
              <View style={styles.cardTop}>
                <Text style={styles.cardLabel}>Available balance</Text>
                <Ionicons
                  name="cash"
                  size={22}
                  color="rgba(255,255,255,0.85)"
                />
              </View>
              <Text style={styles.balance}>
                {formatMoney(wallet?.balance ?? 0)}
              </Text>
              <Text style={styles.total}>Ready to withdraw anytime</Text>
              <View style={styles.heroBtnRow}>
                <AnimatedPressable
                  haptic="medium"
                  onPress={openWithdraw}
                  style={styles.withdrawBtn}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={18}
                    color={colors.navy}
                  />
                  <Text style={styles.withdrawText}>Request withdrawal</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => router.push("/(app)/(earnings)/analytics")}
                  style={styles.analyticsBtn}
                >
                  <Ionicons name="stats-chart" size={16} color="#fff" />
                  <Text style={styles.analyticsText}>Analytics</Text>
                </AnimatedPressable>
              </View>
            </LinearGradient>

            {/* Overview stats */}
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(139,187,233,0.12)" },
                  ]}
                >
                  <Ionicons name="trending-up" size={15} color={colors.teal} />
                </View>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatMoney(stats?.totalEarnings ?? 0, stats?.currency)}
                </Text>
                <Text style={styles.statLabel}>Total earnings</Text>
              </View>
              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(28,74,116,0.10)" },
                  ]}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={15}
                    color={colors.navyMid}
                  />
                </View>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatMoney(stats?.totalWithdrawn ?? 0, stats?.currency)}
                </Text>
                <Text style={styles.statLabel}>Withdrawn</Text>
              </View>
              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(247,144,9,0.14)" },
                  ]}
                >
                  <Ionicons name="time" size={15} color={colors.warning} />
                </View>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatMoney(stats?.pendingWithdrawals ?? 0, stats?.currency)}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            {/* Earnings by period */}
            <View style={styles.periodCard}>
              <View style={styles.segment}>
                {(["today", "week", "month"] as Period[]).map((p) => (
                  <AnimatedPressable
                    key={p}
                    haptic="light"
                    onPress={() => setPeriod(p)}
                    style={[
                      styles.segmentTab,
                      period === p && styles.segmentTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        period === p && styles.segmentTextActive,
                      ]}
                    >
                      {p === "today"
                        ? "Today"
                        : p === "week"
                          ? "This week"
                          : "This month"}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
              <Text style={styles.periodValue}>
                {formatMoney(stats?.earnings?.[period] ?? 0, stats?.currency)}
              </Text>
              <Text style={styles.periodSub}>
                {avgPerConsult > 0
                  ? `Avg ${formatMoney(avgPerConsult, stats?.currency)}/consultation · `
                  : ""}
                {stats?.completedConsultations ?? 0} completed
              </Text>
            </View>

            {/* 7-day earnings sparkline */}
            {days.length > 0 ? (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Last 7 days</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.chartAmount}>
                      {formatMoney(selDay?.amount ?? 0, stats?.currency)}
                    </Text>
                    <Text style={styles.chartDay}>
                      {selectedDay === 6 ? "Today" : selDay?.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.chartBars}>
                  {days.map((d, i) => {
                    const h = 8 + (d.amount / maxDay) * 78;
                    const isSel = i === selectedDay;
                    return (
                      <AnimatedPressable
                        key={d.date}
                        haptic="light"
                        onPress={() => setSelectedDay(i)}
                        style={styles.barCol}
                      >
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: h,
                                backgroundColor: isSel
                                  ? colors.teal
                                  : colors.navySoft,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.barLabel,
                            isSel && {
                              color: colors.navy,
                              fontFamily: Fonts.bold,
                            },
                          ]}
                        >
                          {d.label}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Withdrawal requests</Text>
          </>
        }
        ListEmptyComponent={
          <View style={{ marginTop: 20 }}>
            <EmptyState
              icon="receipt-outline"
              title="No requests yet"
              description="Your withdrawal requests and their status will appear here."
            />
          </View>
        }
        renderItem={({ item: r }) => (
          <View style={styles.reqCard}>
            <View style={styles.reqRow}>
              <View style={styles.reqIcon}>
                <Ionicons name="arrow-up" size={18} color={colors.navyMid} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reqAmount}>
                  {formatMoney(r.amount, stats?.currency)}
                </Text>
                <Text style={styles.reqDate}>
                  {new Date(r.createdAt).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <Badge
                variant={statusVariant(r.status)}
                label={r.status.charAt(0) + r.status.slice(1).toLowerCase()}
              />
            </View>

            {r.paymentDetails?.accountNumber ? (
              <View style={styles.reqMetaRow}>
                <Ionicons
                  name="card-outline"
                  size={13}
                  color={colors.text.tertiary}
                />
                <Text style={styles.reqMeta}>
                  {[r.paymentDetails.bankName, r.paymentDetails.accountNumber]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ) : null}

            {r.status === "ACCEPTED" ? (
              <View style={styles.reqMetaRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={colors.success}
                />
                <Text style={[styles.reqMeta, { color: colors.success }]}>
                  Paid
                  {r.payDate
                    ? ` · ${new Date(r.payDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`
                    : ""}
                </Text>
              </View>
            ) : null}

            {r.status === "DECLINED" ? (
              <View style={styles.reqMetaRow}>
                <Ionicons
                  name="information-circle"
                  size={13}
                  color={colors.error}
                />
                <Text style={[styles.reqMeta, { color: colors.error }]}>
                  {r.declineReason
                    ? `Declined · ${r.declineReason}`
                    : "Declined — amount returned to wallet"}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      />

      {/* Withdraw sheet */}
      <Modal
        visible={showWithdraw}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWithdraw(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 6 }}>
              Request withdrawal
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginBottom: 18 }}
            >
              Available · {formatMoney(wallet?.balance ?? 0)}
            </Txt>

            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="Amount to withdraw"
              placeholderTextColor={colors.text.tertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Bank</Text>
            <AnimatedPressable
              haptic="light"
              onPress={() => setPickerOpen(true)}
              style={styles.selectInput}
            >
              <Text
                style={[
                  styles.selectText,
                  !bank && { color: colors.text.tertiary },
                ]}
              >
                {bank ? bank.name : "Select your bank"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>

            <Text style={styles.fieldLabel}>Account number</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="10-digit account number"
              placeholderTextColor={colors.text.tertiary}
              value={accountNumber}
              onChangeText={(t) =>
                setAccountNumber(t.replace(/[^0-9]/g, "").slice(0, 10))
              }
              keyboardType="number-pad"
              maxLength={10}
            />
            {resolving ? (
              <View style={styles.resolveRow}>
                <ActivityIndicator size="small" color={colors.navyMid} />
                <Text style={styles.resolveText}>Checking account…</Text>
              </View>
            ) : accountName ? (
              <View style={styles.resolveRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.teal}
                />
                <Text style={styles.resolvedName}>{accountName}</Text>
              </View>
            ) : null}

            <View style={styles.sheetBtns}>
              <Button
                label="Cancel"
                onPress={() => setShowWithdraw(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Request"
                onPress={handleWithdraw}
                loading={loading}
                disabled={!canSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank picker */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { height: "78%" }]}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 12 }}>
              Select bank
            </Txt>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search banks"
                placeholderTextColor={colors.text.tertiary}
                value={bankSearch}
                onChangeText={setBankSearch}
              />
            </View>
            {!banks.length ? (
              <View style={{ paddingVertical: 40 }}>
                <ActivityIndicator color={colors.navyMid} />
              </View>
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(b, i) => `${b.code}-${i}`}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item: b }) => (
                  <AnimatedPressable
                    haptic="light"
                    onPress={() => {
                      setBank(b);
                      setPickerOpen(false);
                      setBankSearch("");
                    }}
                    style={styles.bankRow}
                  >
                    <Text style={styles.bankName}>{b.name}</Text>
                    {bank?.code === b.code ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.teal}
                      />
                    ) : null}
                  </AnimatedPressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    list: { paddingHorizontal: Space.xl, paddingBottom: 40 },
    card: {
      borderRadius: Radius.xxl,
      padding: 24,
      overflow: "hidden",
      ...Shadow.raised,
      marginBottom: 8,
    },
    cardBlob: {
      position: "absolute",
      top: -40,
      right: -30,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: "rgba(139,187,233,0.2)",
    },
    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardLabel: {
      ...Type.label,
      color: c.text.onDarkDim,
      letterSpacing: 0.4,
    },
    balance: {
      fontFamily: Fonts.extrabold,
      fontSize: 40,
      color: "#fff",
      letterSpacing: -1.2,
      marginTop: 12,
    },
    total: { ...Type.bodySm, color: c.text.onDarkDim, marginTop: 6 },
    heroBtnRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 20,
    },
    withdrawBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#fff",
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: Radius.round,
    },
    withdrawText: { fontFamily: Fonts.bold, fontSize: 14, color: c.navy },
    analyticsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.25)",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: Radius.round,
    },
    analyticsText: { fontFamily: Fonts.bold, fontSize: 14, color: "#fff" },

    // Analytics
    statRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    statIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    statValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 15,
      color: c.text.primary,
      letterSpacing: -0.3,
    },
    statLabel: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },
    periodCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 18,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: c.background,
      borderRadius: Radius.round,
      padding: 4,
      gap: 2,
    },
    segmentTab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: Radius.round,
      alignItems: "center",
    },
    segmentTabActive: { backgroundColor: c.navy, ...Shadow.card },
    segmentText: {
      fontFamily: Fonts.bold,
      fontSize: 12.5,
      color: c.text.secondary,
    },
    segmentTextActive: { color: "#fff" },
    periodValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 30,
      color: c.text.primary,
      letterSpacing: -0.8,
      marginTop: 16,
    },
    periodSub: { ...Type.caption, color: c.text.tertiary, marginTop: 4 },

    chartCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 18,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    chartTitle: { ...Type.label, color: c.text.secondary },
    chartAmount: {
      fontFamily: Fonts.extrabold,
      fontSize: 18,
      color: c.text.primary,
      letterSpacing: -0.4,
    },
    chartDay: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    barCol: { flex: 1, alignItems: "center", gap: 8 },
    barTrack: {
      height: 86,
      justifyContent: "flex-end",
      width: "100%",
      alignItems: "center",
    },
    bar: { width: "72%", maxWidth: 26, borderRadius: 7, minHeight: 8 },
    barLabel: { ...Type.caption, fontSize: 11, color: c.text.tertiary },

    sectionTitle: {
      ...Type.h2,
      color: c.text.primary,
      marginTop: 24,
      marginBottom: 12,
    },
    reqCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    reqRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    reqIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    reqAmount: { ...Type.h3, color: c.text.primary },
    reqDate: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    reqMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      paddingLeft: 2,
    },
    reqMeta: { ...Type.caption, color: c.text.secondary, flex: 1 },
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
    amountInput: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      height: 56,
      fontFamily: Fonts.bold,
      fontSize: 18,
      color: c.text.primary,
      marginBottom: 16,
    },
    selectInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      height: 56,
      marginBottom: 16,
    },
    selectText: {
      fontFamily: Fonts.semibold,
      fontSize: 16,
      color: c.text.primary,
    },
    resolveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: -6,
      marginBottom: 14,
    },
    resolveText: { ...Type.bodySm, color: c.text.tertiary },
    resolvedName: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.teal,
    },
    sheetBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      height: 50,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: 15,
      color: c.text.primary,
    },
    bankRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    bankName: {
      fontFamily: Fonts.medium,
      fontSize: 15,
      color: c.text.primary,
      flex: 1,
    },
  });
