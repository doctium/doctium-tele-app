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
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";
import { formatMoney } from "../../../src/utils/money";

interface Benefits {
  commissionPercent?: number | null;
  featured?: boolean;
  advancedAnalytics?: boolean;
  recordingPlayback?: boolean;
}
interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  benefits: Benefits;
}
interface Sub {
  id: string;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  lastFour?: string | null;
  plan: Plan;
}
interface Me {
  subscription: Sub | null;
  entitlements: {
    commissionPercent: number | null;
    isFeatured: boolean;
    advancedAnalytics: boolean;
    recordingPlayback: boolean;
  };
}

function benefitLines(b: Benefits): string[] {
  const out: string[] = [];
  if (b.commissionPercent != null)
    out.push(
      `Lower ${b.commissionPercent}% platform commission — keep more per consult`,
    );
  else out.push("Standard platform commission");
  if (b.featured) out.push("Featured listing — rank first in patient search");
  if (b.advancedAnalytics) out.push("Advanced earnings & patient analytics");
  if (b.recordingPlayback) out.push("Secure consultation playback review");
  return out;
}

export default function DoctorSubscriptionScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        doctorApi.getSubPlans(),
        doctorApi.getMySub(),
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

  const subscribe = async (plan: Plan) => {
    setSubmitting(plan.id);
    try {
      const r = await doctorApi.subscribeDoctor(plan.id, "CARD");
      const data = (
        r as { data: { authorizationUrl?: string; activated?: boolean } }
      ).data;
      if (data?.authorizationUrl) {
        setCheckoutUrl(data.authorizationUrl);
      } else {
        Alert.alert("Plan activated", `You’re now on the ${plan.name} plan.`);
        await load();
      }
    } catch (e) {
      Alert.alert(
        "Could not subscribe",
        (e as { message?: string })?.message ?? "Please try again.",
      );
    } finally {
      setSubmitting(null);
    }
  };

  const onCancel = () => {
    Alert.alert(
      "Cancel plan",
      "Your benefits stay active until the end of the current period. Continue?",
      [
        { text: "Keep plan", style: "cancel" },
        {
          text: "Cancel it",
          style: "destructive",
          onPress: async () => {
            try {
              await doctorApi.cancelSub();
              await load();
            } catch (e) {
              Alert.alert(
                "Error",
                (e as { message?: string })?.message ?? "Could not cancel.",
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

  return (
    <View style={styles.root}>
      <AppHeader title="DoctiumPlus for Doctors" />
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
                <Ionicons name="ribbon" size={13} color={colors.navy} />
                <Text style={styles.crownTxt}>
                  {active.plan.benefits.featured ? "FEATURED" : "MEMBER"}
                </Text>
              </View>
              {active.status === "PAST_DUE" ? (
                <Text style={styles.pastDue}>Payment due</Text>
              ) : null}
            </View>
            <Text style={styles.memberPlan}>{active.plan.name}</Text>
            <Text style={styles.memberMeta}>
              {active.plan.benefits.commissionPercent != null
                ? `${active.plan.benefits.commissionPercent}% commission`
                : "Standard commission"}
              {active.plan.benefits.advancedAnalytics
                ? " · Analytics unlocked"
                : ""}
            </Text>
            {active.currentPeriodEnd ? (
              <Text style={styles.memberRenew}>
                {active.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                {new Date(active.currentPeriodEnd).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {active.lastFour ? ` · ••${active.lastFour}` : ""}
              </Text>
            ) : null}
            {!active.cancelAtPeriodEnd && active.plan.price > 0 ? (
              <AnimatedPressable
                haptic="light"
                onPress={onCancel}
                style={styles.cancelChip}
              >
                <Text style={styles.cancelTxt}>Cancel plan</Text>
              </AnimatedPressable>
            ) : null}
          </LinearGradient>
        ) : (
          <View style={styles.intro}>
            <Text style={styles.introTitle}>Grow your practice.</Text>
            <Text style={styles.introBody}>
              Keep more of every consult with a lower commission, rank first in
              patient search, and unlock advanced analytics.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {active ? "Switch plan" : "Choose a plan"}
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
                  <Text style={styles.price}>
                    {plan.price > 0 ? formatMoney(plan.price) : "Free"}
                  </Text>
                  {plan.price > 0 ? (
                    <Text style={styles.priceUnit}>/mo</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.benefits}>
                {benefitLines(plan.benefits).map((line) => (
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
                  <Text style={styles.currentTxt}>Your current plan</Text>
                </View>
              ) : (
                <Button
                  label={
                    plan.price > 0
                      ? active
                        ? "Switch to this plan"
                        : "Subscribe"
                      : "Activate free plan"
                  }
                  onPress={() => subscribe(plan)}
                  loading={submitting === plan.id}
                />
              )}
            </View>
          );
        })}

        <Text style={styles.footNote}>
          Paid plans renew automatically each month. Cancel anytime.
        </Text>
      </ScrollView>

      {/* Paystack checkout */}
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
    memberRenew: { ...Type.caption, color: c.text.onDarkDim, marginTop: 8 },
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
    currentTxt: { fontFamily: Fonts.bold, fontSize: 14, color: c.tealDeep },
    footNote: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 8,
    },
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
