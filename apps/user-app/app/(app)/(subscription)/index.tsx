import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
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
import { subscriptionApi } from "../../../src/api/subscription.api";
import { formatMoney } from "../../../src/utils/money";

interface Benefits {
  consultsPerCycle?: number;
  memberDiscountPercent?: number;
  familyCap?: number;
  unlimitedChat?: boolean;
  priorityBooking?: boolean;
  freeRxDelivery?: boolean;
  waivedBookingFee?: boolean;
  recordingPlayback?: boolean;
}
interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  benefits: Benefits;
}
interface Sub {
  id: string;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  paymentSource: string;
  lastFour?: string | null;
  plan: Plan;
}
interface Usage {
  creditsTotal: number;
  creditsUsed: number;
}
interface Me {
  subscription: Sub | null;
  usage: Usage | null;
  entitlements: { consultsRemaining: number; memberDiscountPercent: number };
}

function benefitLines(b: Benefits, t: TFunction): string[] {
  const out: string[] = [];
  if (b.consultsPerCycle)
    out.push(
      b.consultsPerCycle === 1
        ? t("subscription.benefitConsultsOne", { count: b.consultsPerCycle })
        : t("subscription.benefitConsultsMany", { count: b.consultsPerCycle }),
    );
  if (b.memberDiscountPercent)
    out.push(
      t("subscription.benefitDiscount", { percent: b.memberDiscountPercent }),
    );
  if (b.familyCap)
    out.push(
      b.familyCap === 1
        ? t("subscription.benefitFamilyOne", { count: b.familyCap })
        : t("subscription.benefitFamilyMany", { count: b.familyCap }),
    );
  if (b.unlimitedChat) out.push(t("subscription.benefitUnlimitedChat"));
  if (b.priorityBooking) out.push(t("subscription.benefitPriorityBooking"));
  if (b.freeRxDelivery) out.push(t("subscription.benefitFreeRxDelivery"));
  if (b.waivedBookingFee) out.push(t("subscription.benefitWaivedBookingFee"));
  if (b.recordingPlayback) out.push(t("subscription.benefitRecordingPlayback"));
  return out;
}

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payFor, setPayFor] = useState<Plan | null>(null); // plan pending a payment-source choice
  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        subscriptionApi.getPlans(),
        subscriptionApi.getMine(),
      ]);
      setPlans((p as { data: Plan[] }).data ?? []);
      setMe((m as { data: Me }).data ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const active =
    me?.subscription && ["ACTIVE", "PAST_DUE"].includes(me.subscription.status)
      ? me.subscription
      : null;

  const choosePayment = (plan: Plan) => setPayFor(plan);

  const doSubscribe = async (source: "CARD" | "WALLET") => {
    if (!payFor) return;
    const plan = payFor;
    setSubmitting(true);
    try {
      const isChange = !!active;
      const r = isChange
        ? await subscriptionApi.changePlan(plan.id, source)
        : await subscriptionApi.subscribe(plan.id, source);
      const data = (
        r as { data: { authorizationUrl?: string; activated?: boolean } }
      ).data;
      setPayFor(null);
      if (data?.authorizationUrl) {
        setCheckoutUrl(data.authorizationUrl);
      } else {
        Alert.alert(
          t("subscription.activatedTitle"),
          t("subscription.activatedBody", { plan: plan.name }),
        );
        await load();
      }
    } catch (e) {
      Alert.alert(
        t("subscription.subscribeErrorTitle"),
        (e as { message?: string })?.message ?? t("subscription.tryAgain"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    Alert.alert(
      t("subscription.cancelTitle"),
      t("subscription.cancelMessage"),
      [
        { text: t("subscription.keepMembership"), style: "cancel" },
        {
          text: t("subscription.cancelConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await subscriptionApi.cancel();
              await load();
            } catch (e) {
              Alert.alert(
                t("subscription.errorTitle"),
                (e as { message?: string })?.message ??
                  t("subscription.cancelError"),
              );
            }
          },
        },
      ],
    );
  };

  const onCheckoutNav = (url: string) => {
    if (
      url.includes("/paystack/callback") ||
      url.includes("/checkout/success")
    ) {
      setCheckoutUrl(null);
      load();
      setTimeout(load, 2500);
      setTimeout(load, 6000);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader title="DoctiumPlus" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      </View>
    );
  }

  const remaining = me?.entitlements?.consultsRemaining ?? 0;
  const total = me?.usage?.creditsTotal ?? 0;

  return (
    <View style={styles.root}>
      <AppHeader title="DoctiumPlus" />
      <ScrollView
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
      >
        {active ? (
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.memberCard}
          >
            <View style={styles.cardBlob} />
            <View style={styles.cardTop}>
              <View style={styles.crownChip}>
                <Ionicons name="star" size={13} color={colors.navy} />
                <Text style={styles.crownTxt}>{t("subscription.member")}</Text>
              </View>
              {active.status === "PAST_DUE" ? (
                <Text style={styles.pastDue}>
                  {t("subscription.paymentDue")}
                </Text>
              ) : null}
            </View>
            <Text style={styles.memberPlan}>{active.plan.name}</Text>
            <Text style={styles.memberMeta}>
              {total > 0
                ? t("subscription.consultsLeft", { remaining, total })
                : t("subscription.benefitsActive")}
            </Text>
            {active.currentPeriodEnd ? (
              <Text style={styles.memberRenew}>
                {active.cancelAtPeriodEnd
                  ? t("subscription.ends")
                  : t("subscription.renews")}{" "}
                {new Date(active.currentPeriodEnd).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {active.lastFour ? ` · ••${active.lastFour}` : ""}
              </Text>
            ) : null}
            {!active.cancelAtPeriodEnd ? (
              <AnimatedPressable
                haptic="light"
                onPress={onCancel}
                style={styles.cancelChip}
              >
                <Text style={styles.cancelTxt}>
                  {t("subscription.cancelMembership")}
                </Text>
              </AnimatedPressable>
            ) : null}
          </LinearGradient>
        ) : (
          <View style={styles.intro}>
            <Text style={styles.introTitle}>
              {t("subscription.introTitle")}
            </Text>
            <Text style={styles.introBody}>{t("subscription.introBody")}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {active ? t("subscription.switchPlan") : t("subscription.choosePlan")}
        </Text>

        {plans.map((plan) => {
          const isCurrent = active?.plan.id === plan.id;
          return (
            <View
              key={plan.id}
              style={[styles.planCard, isCurrent && styles.planCardCurrent]}
            >
              <View style={styles.planHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDesc}>{plan.description}</Text>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={styles.price}>{formatMoney(plan.price)}</Text>
                  <Text style={styles.priceUnit}>
                    {t("subscription.perMonthShort")}
                  </Text>
                </View>
              </View>
              <View style={styles.benefits}>
                {benefitLines(plan.benefits, t).map((line) => (
                  <View key={line} style={styles.benefitRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={17}
                      color={colors.teal}
                    />
                    <Text style={styles.benefitTxt}>{line}</Text>
                  </View>
                ))}
              </View>
              {isCurrent ? (
                <View style={styles.currentBadge}>
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={colors.tealDeep}
                  />
                  <Text style={styles.currentTxt}>
                    {t("subscription.currentPlan")}
                  </Text>
                </View>
              ) : (
                <Button
                  label={
                    active
                      ? t("subscription.switchToThisPlan")
                      : t("subscription.subscribe")
                  }
                  onPress={() => choosePayment(plan)}
                />
              )}
            </View>
          );
        })}

        <Text style={styles.footNote}>{t("subscription.footNote")}</Text>
      </ScrollView>

      {/* Payment-source chooser */}
      <Modal
        visible={!!payFor && !checkoutUrl}
        animationType="slide"
        transparent
        onRequestClose={() => setPayFor(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 4 }}>
              {t("subscription.payForPlan", { plan: payFor?.name })}
            </Txt>
            <Text style={styles.sheetSub}>
              {t("subscription.pricePerMonth", {
                price: formatMoney(payFor?.price),
              })}
            </Text>
            <AnimatedPressable
              haptic="medium"
              onPress={() => doSubscribe("CARD")}
              style={styles.payOption}
              disabled={submitting}
            >
              <View style={styles.payIcon}>
                <Ionicons name="card-outline" size={20} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payOptTitle}>
                  {t("subscription.payWithCard")}
                </Text>
                <Text style={styles.payOptSub}>
                  {t("subscription.payWithCardSub")}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>
            <AnimatedPressable
              haptic="medium"
              onPress={() => doSubscribe("WALLET")}
              style={styles.payOption}
              disabled={submitting}
            >
              <View style={styles.payIcon}>
                <Ionicons name="wallet-outline" size={20} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payOptTitle}>
                  {t("subscription.payFromWallet")}
                </Text>
                <Text style={styles.payOptSub}>
                  {t("subscription.payFromWalletSub")}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>
            {submitting ? (
              <ActivityIndicator
                color={colors.teal}
                style={{ marginTop: 14 }}
              />
            ) : null}
            <AnimatedPressable
              haptic="light"
              onPress={() => setPayFor(null)}
              style={styles.sheetCancel}
            >
              <Text style={styles.sheetCancelTxt}>
                {t("subscription.notNow")}
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      {/* Paystack checkout */}
      <Modal
        visible={!!checkoutUrl}
        animationType="slide"
        onRequestClose={() => setCheckoutUrl(null)}
      >
        <View style={styles.webRoot}>
          <View style={styles.webHeader}>
            <Text style={styles.webTitle}>
              {t("subscription.securePayment")}
            </Text>
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: Space.xl, paddingBottom: 130 },
    memberCard: {
      borderRadius: Radius.xxl,
      padding: 24,
      overflow: "hidden",
      ...Shadow.raised,
      marginTop: 8,
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
    crownChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "#fff",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    crownTxt: {
      fontFamily: Fonts.extrabold,
      fontSize: 10,
      color: c.navy,
      letterSpacing: 1,
    },
    pastDue: {
      ...Type.caption,
      color: "#fff",
      backgroundColor: c.error,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.round,
      overflow: "hidden",
    },
    memberPlan: {
      fontFamily: Fonts.extrabold,
      fontSize: 30,
      color: "#fff",
      letterSpacing: -0.8,
      marginTop: 16,
    },
    memberMeta: { ...Type.bodyMed, color: c.text.onDark, marginTop: 4 },
    memberRenew: {
      ...Type.caption,
      color: c.text.onDarkDim,
      marginTop: 8,
    },
    cancelChip: {
      alignSelf: "flex-start",
      marginTop: 18,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.22)",
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: Radius.round,
    },
    cancelTxt: { fontFamily: Fonts.semibold, fontSize: 13, color: "#fff" },
    intro: { marginTop: 12, marginBottom: 4 },
    introTitle: { ...Type.h1, color: c.text.primary },
    introBody: {
      ...Type.body,
      color: c.text.secondary,
      marginTop: 8,
      lineHeight: 22,
    },
    sectionTitle: {
      ...Type.h2,
      color: c.text.primary,
      marginTop: 24,
      marginBottom: 12,
    },
    planCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 20,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      ...Shadow.card,
    },
    planCardCurrent: { borderColor: c.teal, borderWidth: 1.5 },
    planHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    planName: { ...Type.h2, color: c.text.primary },
    planDesc: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginTop: 4,
      lineHeight: 18,
    },
    priceWrap: { flexDirection: "row", alignItems: "flex-end" },
    price: {
      fontFamily: Fonts.extrabold,
      fontSize: 22,
      color: c.navy,
      letterSpacing: -0.5,
    },
    priceUnit: {
      ...Type.caption,
      color: c.text.tertiary,
      marginBottom: 3,
      marginLeft: 1,
    },
    benefits: { marginTop: 16, marginBottom: 16, gap: 9 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    benefitTxt: { ...Type.bodySm, color: c.text.primary, flex: 1 },
    currentBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      backgroundColor: c.tealSoft,
    },
    currentTxt: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: c.tealDeep,
    },
    footNote: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 8,
    },
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
    sheetSub: { ...Type.body, color: c.text.secondary, marginBottom: 18 },
    payOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginBottom: 12,
    },
    payIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    payOptTitle: {
      ...Type.bodyMed,
      color: c.text.primary,
      fontFamily: Fonts.semibold,
    },
    payOptSub: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    sheetCancel: { alignSelf: "center", paddingVertical: 12, marginTop: 6 },
    sheetCancelTxt: { ...Type.bodyMed, color: c.text.secondary },
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
