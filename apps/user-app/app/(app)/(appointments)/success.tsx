import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Fonts,
  Gradients,
  Motion,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable } from "../../../src/components/ui";
import { AuroraField } from "../../../src/components/motion";
import { appointmentsApi } from "../../../src/api/appointments.api";

interface ApptSummary {
  bookingNumber?: number;
  date?: string;
  time?: string;
  type?: string;
  doctor?: { name?: string };
}

/**
 * Booking Confirmed — shown right after a booking is paid & confirmed.
 * Animated check, the booking reference, and two exits: Home / Appointments.
 */
export default function BookingSuccessScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [appt, setAppt] = useState<ApptSummary | null>(null);
  const reduced = useReducedMotion();

  // Check choreography: badge springs in, ripple ring blooms outward once.
  const badge = useSharedValue(reduced ? 1 : 0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (!reduced) {
      badge.value = withDelay(120, withSpring(1, Motion.spring.bouncy));
      ripple.value = withDelay(
        260,
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!id) return;
    appointmentsApi
      .getOne(id)
      .then((r: unknown) => setAppt((r as { data: ApptSummary }).data ?? null))
      .catch(() => {});
  }, [id]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badge.value,
    transform: [{ scale: badge.value }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - ripple.value),
    transform: [{ scale: 1 + ripple.value * 0.9 }],
  }));

  const dateLine = [
    appt?.date,
    appt?.time && appt.time !== "now" ? appt.time : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AuroraField
        blobs={[
          {
            size: 220,
            color: "rgba(44,183,167,0.10)",
            top: -60,
            right: -50,
            duration: 11000,
            driftX: 32,
            driftY: 24,
          },
          {
            size: 200,
            color: "rgba(139,187,233,0.14)",
            top: 120,
            left: -70,
            duration: 14000,
            driftX: 40,
            driftY: 28,
          },
        ]}
      />

      <View style={styles.body}>
        {/* Animated check */}
        <View style={styles.badgeWrap}>
          <Animated.View style={[styles.ripple, rippleStyle]} />
          <Animated.View style={badgeStyle}>
            <LinearGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Ionicons name="checkmark" size={56} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.delay(260).springify().damping(18)}
          style={{ alignItems: "center" }}
        >
          <Text style={styles.title}>Booking confirmed</Text>
          <Text style={styles.sub}>
            Your appointment is locked in
            {appt?.doctor?.name ? ` with ${appt.doctor.name}` : ""}. We've let
            the doctor know.
          </Text>
        </Animated.View>

        {(appt?.bookingNumber || dateLine) && (
          <Animated.View
            entering={FadeInDown.delay(380).springify().damping(18)}
            style={styles.refCard}
          >
            {appt?.bookingNumber ? (
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Booking ID</Text>
                <Text style={styles.refValue}>#{appt.bookingNumber}</Text>
              </View>
            ) : null}
            {dateLine ? (
              <View
                style={[
                  styles.refRow,
                  appt?.bookingNumber ? styles.refRowBorder : null,
                ]}
              >
                <Text style={styles.refLabel}>When</Text>
                <Text style={styles.refValue}>{dateLine}</Text>
              </View>
            ) : null}
          </Animated.View>
        )}
      </View>

      {/* Exits */}
      <Animated.View
        entering={FadeInDown.delay(480).springify().damping(18)}
        style={[
          styles.btnRow,
          { paddingBottom: insets.bottom ? insets.bottom + 8 : 24 },
        ]}
      >
        <AnimatedPressable
          haptic="light"
          onPress={() => router.replace("/(app)/(home)")}
          style={[styles.btn, styles.btnGhost]}
        >
          <Ionicons name="home-outline" size={17} color={colors.text.primary} />
          <Text style={styles.btnGhostText}>Home</Text>
        </AnimatedPressable>
        <AnimatedPressable
          haptic="medium"
          onPress={() => router.replace("/(app)/(appointments)")}
          style={[styles.btn, styles.btnPrimary]}
        >
          <Ionicons name="calendar" size={17} color="#fff" />
          <Text style={styles.btnPrimaryText}>Appointments</Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Space.xxl,
    },
    badgeWrap: {
      width: 150,
      height: 150,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 28,
    },
    ripple: {
      position: "absolute",
      width: 112,
      height: 112,
      borderRadius: 56,
      borderWidth: 2,
      borderColor: c.teal,
    },
    badge: {
      width: 112,
      height: 112,
      borderRadius: 56,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.cta,
    },
    title: { ...Type.display, color: c.text.primary, textAlign: "center" },
    sub: {
      ...Type.body,
      color: c.text.secondary,
      textAlign: "center",
      marginTop: 10,
      maxWidth: "88%",
    },
    refCard: {
      alignSelf: "stretch",
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: 18,
      marginTop: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 15,
    },
    refRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    refLabel: { ...Type.bodySm, color: c.text.tertiary },
    refValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 15,
      color: c.text.primary,
      letterSpacing: -0.2,
    },
    btnRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: Space.xl,
    },
    btn: {
      flex: 1,
      height: 54,
      borderRadius: Radius.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    btnGhost: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    btnGhostText: {
      fontFamily: Fonts.bold,
      fontSize: 15,
      color: c.text.primary,
    },
    btnPrimary: { backgroundColor: c.navy, ...Shadow.cta },
    btnPrimaryText: { fontFamily: Fonts.bold, fontSize: 15, color: "#fff" },
  });
