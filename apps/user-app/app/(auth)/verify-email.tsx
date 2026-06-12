import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import {
  Fonts,
  Gradients,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../src/theme";
import { AnimatedPressable } from "../../src/components/ui";
import { AuroraField } from "../../src/components/motion";
import { authApi } from "../../src/api/auth.api";

const CODE_LEN = 6;
const RESEND_COOLDOWN = 45; // seconds

/**
 * Post-signup email verification: type the 6-digit code from the email
 * (or tap the link inside it — both mark the account verified).
 */
export default function VerifyEmailScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (verifying || verified) return;
    setVerifying(true);
    setError("");
    Keyboard.dismiss();
    try {
      await authApi.verifyEmail(email ?? "", value);
      setVerified(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setTimeout(() => router.replace("/(app)/(home)"), 1600);
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ??
          "That code didn't work — try again.",
      );
      setCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    } finally {
      setVerifying(false);
    }
  };

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, CODE_LEN);
    setCode(digits);
    setError("");
    if (digits.length === CODE_LEN) submit(digits);
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try {
      await authApi.sendEmailVerification(email ?? "");
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setError("Couldn't resend right now — try again shortly.");
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <AuroraField
        blobs={[
          {
            size: 220,
            color: "rgba(19,49,87,0.07)",
            top: -70,
            right: -60,
            duration: 11000,
            driftX: 32,
            driftY: 24,
          },
          {
            size: 190,
            color: "rgba(139,187,233,0.15)",
            top: 130,
            left: -70,
            duration: 14000,
            driftX: 40,
            driftY: 26,
          },
        ]}
      />

      {verified ? (
        /* ── Verified! ── */
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <LinearGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Ionicons name="checkmark" size={48} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(180).springify().damping(18)}
            style={{ alignItems: "center" }}
          >
            <Text style={styles.title}>Email verified successfully</Text>
            <Text style={styles.sub}>Taking you to your dashboard…</Text>
          </Animated.View>
        </View>
      ) : (
        <>
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            style={{ alignItems: "center" }}
          >
            <View style={styles.mailIcon}>
              <Ionicons name="mail-unread" size={30} color={colors.teal} />
            </View>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.sub}>
              We sent a 6-digit code to{"\n"}
              <Text style={styles.email}>{email}</Text>
              {"\n"}Enter it below — or simply tap the link in the email.
            </Text>
          </Animated.View>

          {/* Code boxes (one hidden input drives all six) */}
          <Animated.View
            entering={FadeInDown.delay(120).springify().damping(18)}
          >
            <Pressable
              style={styles.codeRow}
              onPress={() => inputRef.current?.focus()}
            >
              {Array.from({ length: CODE_LEN }, (_, i) => {
                const filled = i < code.length;
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    style={[
                      styles.codeBox,
                      active && styles.codeBoxActive,
                      filled && styles.codeBoxFilled,
                    ]}
                  >
                    <Text style={styles.codeChar}>{code[i] ?? ""}</Text>
                  </View>
                );
              })}
            </Pressable>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onChange}
              keyboardType="number-pad"
              maxLength={CODE_LEN}
              autoFocus
              style={styles.hiddenInput}
            />
          </Animated.View>

          {error ? (
            <Animated.Text
              entering={FadeInDown.springify()}
              style={styles.error}
            >
              {error}
            </Animated.Text>
          ) : null}
          {verifying ? (
            <ActivityIndicator color={colors.teal} style={{ marginTop: 18 }} />
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(220).springify().damping(18)}
            style={styles.footer}
          >
            <AnimatedPressable
              haptic="light"
              onPress={resend}
              style={[styles.resendBtn, cooldown > 0 && { opacity: 0.45 }]}
            >
              <Ionicons name="refresh" size={15} color={colors.teal} />
              <Text style={styles.resendText}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              haptic={false}
              onPress={() => router.replace("/(app)/(home)")}
            >
              <Text style={styles.skip}>Verify later</Text>
            </AnimatedPressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: Space.xxl,
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    badge: {
      width: 104,
      height: 104,
      borderRadius: 52,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
      ...Shadow.cta,
    },
    mailIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    title: { ...Type.display, color: c.text.primary, textAlign: "center" },
    sub: {
      ...Type.body,
      color: c.text.secondary,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 24,
    },
    email: { fontFamily: Fonts.bold, color: c.text.primary },

    codeRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      marginTop: 32,
    },
    codeBox: {
      width: 48,
      height: 58,
      borderRadius: Radius.md,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.card,
    },
    codeBoxActive: { borderColor: c.teal },
    codeBoxFilled: { borderColor: c.navyMid },
    codeChar: {
      fontFamily: Fonts.extrabold,
      fontSize: 24,
      color: c.text.primary,
    },
    hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },

    error: {
      ...Type.bodySm,
      color: c.error,
      textAlign: "center",
      marginTop: 16,
    },
    footer: { alignItems: "center", marginTop: 30, gap: 18 },
    resendBtn: { flexDirection: "row", alignItems: "center", gap: 7 },
    resendText: { ...Type.label, color: c.teal },
    skip: { ...Type.bodySm, color: c.text.tertiary },
  });
