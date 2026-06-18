import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import {
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
import {
  AnimatedPressable,
  AppHeader,
  Card,
  Txt,
} from "../../../src/components/ui";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { appointmentsApi } from "../../../src/api/appointments.api";
import { walletApi } from "../../../src/api/wallet.api";
import { formatMoney } from "../../../src/utils/money";

type Method = "WALLET" | "PAYSTACK";

export default function ConfirmBookingScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { doctorId, date, time, type, problem, mode, referralId } =
    useLocalSearchParams<{
      doctorId: string;
      date: string;
      time: string;
      type: string;
      problem: string;
      mode?: string;
      referralId?: string;
    }>();
  const isInstant = mode === "INSTANT";
  const { selected: doctor } = useAppSelector((s) => s.doctors);
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("WALLET");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const d = doctor as {
    charge?: number;
    name?: string;
    scheduledFee?: number;
    instantDayFee?: number;
    instantNightFee?: number;
    discountActive?: boolean;
    discountPercent?: number;
    discountEndsAt?: string | null;
  } | null;

  const isNight = (() => {
    const h = new Date().getHours();
    return h >= 20 || h < 6;
  })();
  // Instant uses the doctor's instant fee (no base-charge fallback); scheduled falls back to charge.
  const instantTier = isNight
    ? d?.instantNightFee || d?.instantDayFee
    : d?.instantDayFee || d?.instantNightFee;
  const baseFee = isInstant
    ? instantTier || 0
    : d?.scheduledFee || d?.charge || 0;
  // Apply the doctor's live promotion so the summary matches what the server charges.
  const discountPct =
    d?.discountActive &&
    d?.discountPercent &&
    d.discountPercent > 0 &&
    (!d.discountEndsAt || new Date(d.discountEndsAt).getTime() > Date.now())
      ? Math.min(d.discountPercent, 100)
      : 0;
  const fee =
    discountPct > 0 ? Math.round(baseFee * (1 - discountPct / 100)) : baseFee;
  const total = Math.max(0, fee - discount);
  const insufficient = balance !== null && balance < total;

  useEffect(() => {
    walletApi
      .getWallet()
      .then((r: unknown) =>
        setBalance((r as { data?: { balance?: number } }).data?.balance ?? 0),
      )
      .catch(() => setBalance(0));
  }, []);
  // If the wallet can't cover it, default to card.
  useEffect(() => {
    if (insufficient && method === "WALLET") setMethod("PAYSTACK");
  }, [insufficient]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = (await appointmentsApi.validate_coupon(couponCode, fee)) as {
        data: { discount: number };
      };
      setDiscount(res.data.discount);
      setCouponMsg(
        t("booking.confirm.couponApplied", {
          amount: formatMoney(res.data.discount),
        }),
      );
    } catch {
      setCouponMsg(t("booking.confirm.couponInvalid"));
      setDiscount(0);
    }
  };

  // Hold the created appointment id so the card-checkout callback can route
  // to the Booking Confirmed screen too.
  const bookedIdRef = React.useRef<string | null>(null);
  const goSuccess = (id?: string | null) =>
    router.replace({
      pathname: "/(app)/(appointments)/success",
      params: id ? { id } : {},
    });

  const confirmBooking = async () => {
    setLoading(true);
    setError("");
    try {
      const res = (await appointmentsApi.book({
        doctorId,
        date,
        time,
        type,
        mode: isInstant ? "INSTANT" : "SCHEDULED",
        paymentMethod: method,
        details: problem,
        couponCode: couponCode || undefined,
        referralId: referralId || undefined,
      })) as { data: { id: string } };
      bookedIdRef.current = res.data.id;

      if (method === "WALLET") {
        goSuccess(res.data.id);
        return;
      }

      // Card: initialise a Paystack payment for the just-created (PENDING) appointment.
      const pay = (await appointmentsApi.payInit(res.data.id)) as {
        data: { authorizationUrl?: string; free?: boolean };
      };
      if (pay.data.free || !pay.data.authorizationUrl) {
        goSuccess(res.data.id);
        return;
      }
      setCheckoutUrl(pay.data.authorizationUrl);
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ??
          t("booking.confirm.bookingFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const onCheckoutNav = (url: string) => {
    if (
      url.includes("/paystack/callback") ||
      url.includes("/checkout/success")
    ) {
      setCheckoutUrl(null);
      goSuccess(bookedIdRef.current);
    }
  };

  const payLabel =
    total === 0
      ? t("booking.confirm.payConfirm")
      : method === "WALLET"
        ? t("booking.confirm.payWallet", { price: formatMoney(total) })
        : t("booking.confirm.payCard", { price: formatMoney(total) });

  return (
    <View style={styles.root}>
      <AppHeader title={t("booking.confirm.title")} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            {t("booking.confirm.summary")}
          </Txt>
          <Row
            label={t("booking.confirm.doctor")}
            value={d?.name ?? t("booking.confirm.doctorFallback")}
          />
          <Row
            label={t("booking.confirm.mode")}
            value={
              isInstant
                ? t("booking.confirm.modeInstant")
                : t("booking.confirm.modeScheduled")
            }
          />
          {!isInstant ? (
            <Row label={t("booking.confirm.date")} value={date} />
          ) : null}
          {!isInstant ? (
            <Row label={t("booking.confirm.time")} value={time} />
          ) : null}
          <Row
            label={t("booking.confirm.type")}
            value={
              type === "ONLINE"
                ? t("booking.confirm.typeVideo")
                : t("booking.confirm.typeClinic")
            }
          />
          {problem ? (
            <Row label={t("booking.confirm.reason")} value={problem} />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            {t("booking.confirm.coupon")}
          </Txt>
          <View style={styles.couponRow}>
            <TextInput
              style={styles.couponInput}
              placeholder={t("booking.confirm.couponPlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              value={couponCode}
              onChangeText={setCouponCode}
              autoCapitalize="characters"
            />
            <Button
              label={t("booking.confirm.apply")}
              onPress={applyCoupon}
              variant="outline"
              size="sm"
              fullWidth={false}
            />
          </View>
          {couponMsg ? (
            <Text
              style={[
                styles.couponMsg,
                discount > 0 && { color: colors.tealDeep },
              ]}
            >
              {couponMsg}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            {t("booking.confirm.paymentMethod")}
          </Txt>
          <PayOption
            active={method === "WALLET"}
            disabled={insufficient}
            icon="wallet"
            label={t("booking.confirm.wallet")}
            sub={
              balance === null
                ? t("booking.confirm.checkingBalance")
                : insufficient
                  ? t("booking.confirm.balanceTooLow", {
                      balance: formatMoney(balance),
                    })
                  : t("booking.confirm.balance", {
                      balance: formatMoney(balance),
                    })
            }
            subColor={insufficient ? colors.error : undefined}
            onPress={() => !insufficient && setMethod("WALLET")}
          />
          <PayOption
            active={method === "PAYSTACK"}
            icon="card"
            label={t("booking.confirm.payByCard")}
            sub={t("booking.confirm.payByCardSub")}
            onPress={() => setMethod("PAYSTACK")}
          />
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            {t("booking.confirm.paymentSummary")}
          </Txt>
          <Row
            label={
              isInstant
                ? isNight
                  ? t("booking.confirm.instantFeeNight")
                  : t("booking.confirm.instantFee")
                : t("booking.confirm.consultationFee")
            }
            value={formatMoney(fee)}
          />
          {discount > 0 ? (
            <Row
              label={t("booking.confirm.couponDiscount")}
              value={`−${formatMoney(discount)}`}
              valueColor={colors.tealDeep}
            />
          ) : null}
          <View style={styles.divider} />
          <Row
            label={t("booking.confirm.total")}
            value={formatMoney(total)}
            bold
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom ? insets.bottom : 16 },
        ]}
      >
        <Button
          label={payLabel}
          onPress={confirmBooking}
          loading={loading}
          size="lg"
          icon={
            <Ionicons
              name={method === "WALLET" ? "lock-closed" : "card"}
              size={16}
              color="#fff"
            />
          }
        />
      </View>

      {/* Paystack checkout */}
      <Modal
        visible={!!checkoutUrl}
        animationType="slide"
        onRequestClose={() => setCheckoutUrl(null)}
      >
        <View style={styles.webRoot}>
          <View style={styles.webHeader}>
            <Text style={styles.webTitle}>
              {t("booking.confirm.securePayment")}
            </Text>
            <AnimatedPressable
              haptic="light"
              onPress={() => setCheckoutUrl(null)}
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

function PayOption({
  active,
  disabled,
  icon,
  label,
  sub,
  subColor,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  subColor?: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <AnimatedPressable
      haptic="light"
      onPress={onPress}
      style={[
        styles.payRow,
        active && styles.payRowActive,
        disabled && { opacity: 0.5 },
      ]}
    >
      <View
        style={[styles.payIcon, active && { backgroundColor: colors.teal }]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={active ? "#fff" : colors.navyMid}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.payLabel}>{label}</Text>
        <Text
          style={[styles.payBalance, subColor ? { color: subColor } : null]}
        >
          {sub}
        </Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioInner} /> : null}
      </View>
    </AnimatedPressable>
  );
}

function Row({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          bold ? styles.rowValueBold : styles.rowValue,
          valueColor ? { color: valueColor } : null,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 110, paddingTop: 4 },
    card: { marginBottom: 14 },
    cardTitle: { marginBottom: 14 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 11,
      gap: 16,
    },
    rowLabel: { ...Type.body, color: c.text.secondary },
    rowValue: {
      ...Type.bodyMed,
      color: c.text.primary,
      maxWidth: "62%",
      textAlign: "right",
    },
    rowValueBold: {
      fontFamily: Fonts.extrabold,
      fontSize: 18,
      color: c.navy,
      letterSpacing: -0.4,
    },
    couponRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    couponInput: {
      flex: 1,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      height: 46,
      ...Type.bodyMed,
      color: c.text.primary,
    },
    couponMsg: { ...Type.bodySm, marginTop: 10, color: c.error },
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: Radius.md,
      marginHorizontal: -8,
    },
    payRowActive: { backgroundColor: c.tealSoft },
    payIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    payLabel: { ...Type.bodyMed, color: c.text.primary },
    payBalance: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: { borderColor: c.teal },
    radioInner: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: c.teal,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 10,
    },
    error: {
      ...Type.bodySm,
      color: c.error,
      textAlign: "center",
      marginBottom: 12,
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      paddingHorizontal: Space.xl,
      paddingTop: 14,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      ...Shadow.floating,
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
