import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../src/components/ui";
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../src/theme";
import { authApi } from "../../src/api/auth.api";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { setTokens } from "../../src/store/slices/authSlice";

export default function OtpLoginScreen() {
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendOtp = async () => {
    if (!mobile.trim()) {
      setError(t("auth.otp.enterMobile"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.sendOtp(mobile);
      setStep("otp");
      setCountdown(60);
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ?? t("auth.otp.sendFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) refs.current[idx + 1]?.focus();
    if (!val && idx > 0) refs.current[idx - 1]?.focus();
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError(t("auth.otp.enterCode"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const tokens = await authApi.verifyOtp(mobile, code);
      await SecureStore.setItemAsync("accessToken", tokens.accessToken);
      dispatch(setTokens({ ...tokens, userId: "" }));
      router.replace("/(app)/(home)");
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ?? t("auth.otp.invalidCode"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.blob} />
      <AppHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.logo}>
            <Image
              source={require("../../assets/brand/doctium-logo-lightbg.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>

          <Txt variant="hero">
            {step === "phone"
              ? t("auth.otp.titlePhone")
              : t("auth.otp.titleVerify")}
          </Txt>
          <Txt
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: 8, marginBottom: 28 }}
          >
            {step === "phone"
              ? t("auth.otp.subtitlePhone")
              : t("auth.otp.subtitleVerify", { mobile })}
          </Txt>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === "phone" ? (
            <>
              <Input
                label={t("auth.otp.mobileLabel")}
                placeholder="0800 000 0000"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                leftIcon={
                  <Ionicons
                    name="call-outline"
                    size={19}
                    color={colors.text.tertiary}
                  />
                }
              />
              <Button
                label={t("auth.otp.sendCode")}
                onPress={sendOtp}
                loading={loading}
                size="lg"
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <Animated.View entering={FadeIn}>
              <View style={styles.otpRow}>
                {otp.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => {
                      if (r) refs.current[i] = r;
                    }}
                    style={[styles.otpBox, d ? styles.otpFilled : null]}
                    value={d}
                    onChangeText={(v) => handleOtpChange(v, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>
              <Button
                label={t("auth.otp.verifySignIn")}
                onPress={verifyOtp}
                loading={loading}
                size="lg"
              />
              <AnimatedPressable
                haptic={false}
                onPress={countdown > 0 ? () => {} : sendOtp}
                style={styles.resend}
              >
                <Text
                  style={[
                    styles.resendText,
                    countdown > 0 && { color: colors.text.tertiary },
                  ]}
                >
                  {countdown > 0
                    ? t("auth.otp.resendIn", { seconds: countdown })
                    : t("auth.otp.resend")}
                </Text>
              </AnimatedPressable>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    blob: {
      position: "absolute",
      top: -70,
      left: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(139,187,233,0.14)",
    },
    content: { flex: 1, paddingHorizontal: Space.xxl, paddingTop: 12 },
    logo: {
      width: 76,
      height: 76,
      borderRadius: Radius.xl,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
      backgroundColor: "#fff",
      padding: 13,
      ...Shadow.card,
    },
    logoImg: { width: "100%", height: "100%" },
    error: { ...Type.bodySm, color: c.error, marginBottom: 14 },
    otpRow: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      marginBottom: 30,
    },
    otpBox: {
      width: 50,
      height: 62,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      fontFamily: Fonts.bold,
      fontSize: 24,
      color: c.text.primary,
      backgroundColor: c.surface,
    },
    otpFilled: { borderColor: c.teal, backgroundColor: c.tealSoft },
    resend: { alignItems: "center", marginTop: 18 },
    resendText: { ...Type.label, color: c.teal },
  });
