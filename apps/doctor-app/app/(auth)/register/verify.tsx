import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { apiClient } from "../../../src/api/client";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { setTokens } from "../../../src/store/slices/authSlice";

export default function DoctorRegisterVerifyScreen() {
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const p = useLocalSearchParams<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    speciality: string;
    consultantSpeciality: string;
    languages?: string;
    devEmailCode?: string;
    devPhoneCode?: string;
  }>();

  const [emailCode, setEmailCode] = useState(p.devEmailCode ?? "");
  const [phoneCode, setPhoneCode] = useState(p.devPhoneCode ?? "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const dev = !!(p.devEmailCode || p.devPhoneCode);

  const clean = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 6);

  const submit = async () => {
    if (emailCode.length !== 6 || phoneCode.length !== 6) {
      setError("Enter both 6-digit codes");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = (await apiClient.post("/auth/doctor/register", {
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        password: p.password,
        speciality: p.speciality,
        consultantSpeciality: p.consultantSpeciality || undefined,
        languages: p.languages ? p.languages.split(",").filter(Boolean) : [],
        emailCode,
        phoneCode,
      })) as { data: { accessToken: string; refreshToken: string } };

      dispatch(
        setTokens({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          doctorId: "",
        }),
      );
      router.replace("/(app)/(dashboard)");
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError("");
    try {
      const res = (await apiClient.post("/auth/doctor/register/send-otp", {
        email: p.email,
        phone: p.phone,
      })) as { data: { devEmailCode?: string; devPhoneCode?: string } };
      if (res.data?.devEmailCode) setEmailCode(res.data.devEmailCode);
      if (res.data?.devPhoneCode) setPhoneCode(res.data.devPhoneCode);
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ?? "Could not resend codes",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Verify your details" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Txt
            variant="body"
            color={colors.text.secondary}
            style={{ marginBottom: 20 }}
          >
            We sent a 6-digit code to your email ({p.email}) and your phone (
            {p.phone}). Enter both to finish creating your account.
          </Txt>

          {dev ? (
            <View style={styles.devBox}>
              <Ionicons
                name="construct-outline"
                size={16}
                color={colors.interactive}
              />
              <Text style={styles.devText}>
                Dev mode: codes pre-filled (no live SMS/email provider
                configured).
              </Text>
            </View>
          ) : null}

          {error ? (
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.errorBox}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Text style={styles.label}>Email code</Text>
          <TextInput
            style={styles.codeInput}
            value={emailCode}
            onChangeText={(v) => setEmailCode(clean(v))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.text.tertiary}
            textAlign="center"
          />

          <Text style={[styles.label, { marginTop: 18 }]}>Phone code</Text>
          <TextInput
            style={styles.codeInput}
            value={phoneCode}
            onChangeText={(v) => setPhoneCode(clean(v))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.text.tertiary}
            textAlign="center"
          />

          <Button
            label="Verify & create account"
            onPress={submit}
            loading={loading}
            size="lg"
            style={{ marginTop: 24 }}
          />

          <View style={styles.resendRow}>
            <Text style={styles.greyText}>Didn&apos;t get the codes? </Text>
            <AnimatedPressable
              haptic={false}
              onPress={resend}
              disabled={resending}
            >
              <Text style={styles.link}>
                {resending ? "Sending…" : "Resend"}
              </Text>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xxl, paddingBottom: 48 },
    label: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: c.text.secondary,
      marginBottom: 8,
      marginLeft: 2,
      letterSpacing: -0.1,
    },
    codeInput: {
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      height: 62,
      fontFamily: Fonts.bold,
      fontSize: 26,
      letterSpacing: 8,
      color: c.text.primary,
    },
    devBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.skySoft,
      borderRadius: Radius.md,
      padding: 12,
      marginBottom: 16,
    },
    devText: { ...Type.caption, color: c.interactive, flex: 1 },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.errorSoft,
      borderRadius: Radius.md,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { ...Type.bodySm, color: c.error, flex: 1 },
    resendRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 24,
    },
    greyText: { ...Type.body, color: c.text.secondary },
    link: { ...Type.body, fontFamily: Fonts.bold, color: c.interactive },
  });
