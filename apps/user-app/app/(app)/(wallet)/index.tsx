import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import {
  Gradients,
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { walletApi } from "../../../src/api/wallet.api";
import { formatMoney, toStoredAmount } from "../../../src/utils/money";

interface WalletHistory {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}
interface Wallet {
  balance: number;
  history: WalletHistory[];
}
interface Dva {
  accountNumber: string;
  accountName: string;
  bankName: string;
}

const TOP_UP_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

export default function WalletScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [tab, setTab] = useState<"card" | "bank">("card");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [dva, setDva] = useState<Dva | null>(null);
  const [dvaLoading, setDvaLoading] = useState(false);

  const load = useCallback(
    () =>
      walletApi
        .getWallet()
        .then((r: unknown) => setWallet((r as { data: Wallet }).data))
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openSheet = () => {
    setShowSheet(true);
    setTab("card");
    setError("");
  };

  const startCardTopup = async () => {
    const val = parseInt(amount, 10);
    if (!val || val < 100) {
      setError("Enter an amount of at least ₦100");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // The patient enters naira; the wallet/Paystack API works in kobo.
      const r = (await walletApi.initTopup(toStoredAmount(val))) as {
        data: { authorizationUrl: string };
      };
      setCheckoutUrl(r.data.authorizationUrl);
    } catch (e) {
      setError(
        (e as { message?: string })?.message ?? "Could not start payment",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDva = async () => {
    if (dva) return;
    setDvaLoading(true);
    setError("");
    try {
      const r = (await walletApi.getDVA()) as { data: Dva };
      setDva(r.data);
    } catch (e) {
      setError(
        (e as { message?: string })?.message ??
          "Could not load your account number",
      );
    } finally {
      setDvaLoading(false);
    }
  };

  // When the Paystack checkout reaches our callback URL, the payment is done; close and refresh
  // (the wallet is credited by the server webhook — poll a few times to reflect it).
  const onCheckoutNav = (url: string) => {
    if (
      url.includes("/paystack/callback") ||
      url.includes("/checkout/success")
    ) {
      setCheckoutUrl(null);
      setShowSheet(false);
      setAmount("");
      load();
      setTimeout(load, 2500);
      setTimeout(load, 6000);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Wallet" />

      <FlatList
        data={wallet?.history ?? []}
        keyExtractor={(h) => h.id}
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
                <Text style={styles.cardLabel}>Doctium Wallet</Text>
                <Ionicons
                  name="wallet"
                  size={22}
                  color="rgba(255,255,255,0.85)"
                />
              </View>
              <Text style={styles.balance}>
                {formatMoney(wallet?.balance ?? 0)}
              </Text>
              <AnimatedPressable
                haptic="medium"
                onPress={openSheet}
                style={styles.topUpBtn}
              >
                <Ionicons name="add" size={18} color={colors.navy} />
                <Text style={styles.topUpText}>Add money</Text>
              </AnimatedPressable>
            </LinearGradient>
            <Text style={styles.sectionTitle}>Transactions</Text>
          </>
        }
        ListEmptyComponent={
          <View style={{ marginTop: 30 }}>
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              description="Your top-ups and payments will show up here."
            />
          </View>
        }
        renderItem={({ item }) => {
          const credit =
            item.type === "DEPOSIT" || item.type === "APPOINTMENT_REFUND";
          return (
            <View style={styles.txRow}>
              <View
                style={[
                  styles.txIcon,
                  {
                    backgroundColor: credit
                      ? colors.successSoft
                      : colors.errorSoft,
                  },
                ]}
              >
                <Ionicons
                  name={credit ? "arrow-down" : "arrow-up"}
                  size={18}
                  color={credit ? colors.success : colors.error}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(item.createdAt).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: credit ? colors.tealDeep : colors.error },
                ]}
              >
                {credit ? "+" : "−"}
                {formatMoney(item.amount)}
              </Text>
            </View>
          );
        }}
      />

      {/* Top-up sheet */}
      <Modal
        visible={showSheet && !checkoutUrl}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSheet(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 16 }}>
              Add money
            </Txt>

            <View style={styles.tabs}>
              <AnimatedPressable
                haptic="light"
                onPress={() => {
                  setTab("card");
                  setError("");
                }}
                style={[styles.tab, tab === "card" && styles.tabActive]}
              >
                <Ionicons
                  name="card-outline"
                  size={16}
                  color={tab === "card" ? "#fff" : colors.text.secondary}
                />
                <Text
                  style={[styles.tabTxt, tab === "card" && styles.tabTxtActive]}
                >
                  Card
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                haptic="light"
                onPress={() => {
                  setTab("bank");
                  setError("");
                  loadDva();
                }}
                style={[styles.tab, tab === "bank" && styles.tabActive]}
              >
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={tab === "bank" ? "#fff" : colors.text.secondary}
                />
                <Text
                  style={[styles.tabTxt, tab === "bank" && styles.tabTxtActive]}
                >
                  Bank transfer
                </Text>
              </AnimatedPressable>
            </View>

            {tab === "card" ? (
              <>
                <View style={styles.quickAmounts}>
                  {TOP_UP_AMOUNTS.map((a) => {
                    const active = amount === String(a);
                    return (
                      <AnimatedPressable
                        key={a}
                        haptic="light"
                        onPress={() => setAmount(String(a))}
                        style={[styles.qAmount, active && styles.qAmountActive]}
                      >
                        <Text
                          style={[
                            styles.qAmountText,
                            active && { color: "#fff" },
                          ]}
                        >
                          {formatMoney(toStoredAmount(a))}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Or enter a custom amount"
                  placeholderTextColor={colors.text.tertiary}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                />
                {error ? <Text style={styles.err}>{error}</Text> : null}
                <Button
                  label="Continue to payment"
                  onPress={startCardTopup}
                  loading={loading}
                  icon={<Ionicons name="lock-closed" size={16} color="#fff" />}
                />
                <Text style={styles.secureNote}>
                  Secured by Paystack · cards, transfer & USSD
                </Text>
              </>
            ) : (
              <View style={{ minHeight: 160 }}>
                {dvaLoading ? (
                  <View style={styles.dvaLoading}>
                    <ActivityIndicator color={colors.teal} />
                    <Text style={styles.dvaLoadingTxt}>
                      Setting up your account…
                    </Text>
                  </View>
                ) : dva ? (
                  <>
                    <Text style={styles.dvaIntro}>
                      Transfer any amount to this account and your wallet is
                      funded automatically.
                    </Text>
                    <View style={styles.dvaCard}>
                      <DvaRow label="Bank" value={dva.bankName} />
                      <DvaRow
                        label="Account number"
                        value={dva.accountNumber}
                        big
                        copyable
                      />
                      <DvaRow label="Account name" value={dva.accountName} />
                    </View>
                  </>
                ) : (
                  <View style={styles.dvaLoading}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={26}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.dvaLoadingTxt}>
                      {error || "Account number unavailable right now."}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Paystack checkout WebView */}
      <Modal
        visible={!!checkoutUrl}
        animationType="slide"
        onRequestClose={() => setCheckoutUrl(null)}
      >
        <View style={styles.webRoot}>
          <View style={styles.webHeader}>
            <Text style={styles.webTitle}>Secure payment</Text>
            <AnimatedPressable
              haptic="light"
              onPress={() => {
                setCheckoutUrl(null);
                load();
              }}
              style={styles.webClose}
            >
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </AnimatedPressable>
          </View>
          {checkoutUrl ? (
            <WebView
              source={{ uri: checkoutUrl }}
              onNavigationStateChange={(s) => onCheckoutNav(s.url)}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator color={colors.teal} size="large" />
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function DvaRow({
  label,
  value,
  big,
  copyable,
}: {
  label: string;
  value: string;
  big?: boolean;
  copyable?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <View style={styles.dvaRow}>
      <Text style={styles.dvaLabel}>{label}</Text>
      <View style={styles.dvaValueWrap}>
        <Text style={[styles.dvaValue, big && styles.dvaValueBig]} selectable>
          {value}
        </Text>
        {copyable ? (
          <AnimatedPressable
            haptic="light"
            onPress={copy}
            hitSlop={10}
            style={styles.copyBtn}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={16}
              color={copied ? colors.tealDeep : colors.navyMid}
            />
            <Text
              style={[
                styles.copyTxt,
                { color: copied ? colors.tealDeep : colors.navyMid },
              ]}
            >
              {copied ? "Copied" : "Copy"}
            </Text>
          </AnimatedPressable>
        ) : null}
      </View>
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
      backgroundColor: "rgba(139,187,233,0.20)",
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
      marginTop: 14,
    },
    topUpBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: "#fff",
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: Radius.round,
      marginTop: 20,
    },
    topUpText: { fontFamily: Fonts.bold, fontSize: 14, color: c.navy },
    sectionTitle: {
      ...Type.h2,
      color: c.text.primary,
      marginTop: 24,
      marginBottom: 8,
    },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    txIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    txDesc: { ...Type.bodyMed, color: c.text.primary },
    txDate: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    txAmount: { fontFamily: Fonts.bold, fontSize: 15, letterSpacing: -0.2 },
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
    tabs: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      padding: 4,
      marginBottom: 18,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: Radius.sm,
    },
    tabActive: { backgroundColor: c.navy },
    tabTxt: { ...Type.label, color: c.text.secondary },
    tabTxtActive: { color: "#fff" },
    quickAmounts: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 16,
    },
    qAmount: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    qAmountActive: { backgroundColor: c.navy, borderColor: c.navy },
    qAmountText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: c.text.secondary,
    },
    amountInput: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      height: 54,
      ...Type.bodyMed,
      color: c.text.primary,
      marginBottom: 14,
    },
    err: { ...Type.bodySm, color: c.error, marginBottom: 12 },
    secureNote: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 12,
    },
    dvaLoading: {
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 30,
    },
    dvaLoadingTxt: {
      ...Type.bodySm,
      color: c.text.secondary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    dvaIntro: {
      ...Type.bodySm,
      color: c.text.secondary,
      lineHeight: 19,
      marginBottom: 14,
    },
    dvaCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.lg,
      padding: 16,
    },
    dvaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      gap: 16,
    },
    dvaLabel: { ...Type.body, color: c.text.secondary },
    dvaValueWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
    },
    dvaValue: {
      ...Type.bodyMed,
      color: c.text.primary,
      fontFamily: Fonts.semibold,
      textAlign: "right",
      flexShrink: 1,
    },
    dvaValueBig: {
      fontFamily: Fonts.extrabold,
      fontSize: 16,
      color: c.text.primary,
      letterSpacing: 0.3,
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: Radius.round,
      backgroundColor: c.navySoft,
    },
    copyTxt: { ...Type.caption, fontFamily: Fonts.semibold },
    webRoot: { flex: 1, backgroundColor: c.surface },
    webHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Space.xl,
      paddingVertical: 14,
      paddingTop: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    webTitle: { ...Type.h3, color: c.text.primary },
    webClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    webLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
  });
