import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../src/components/ui";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../src/theme";
import { authApi } from "../../src/api/auth.api";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { setTokens } from "../../src/store/slices/authSlice";

export default function RegisterScreen() {
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  // A share link (…/register?ref=CODE) lands here with the referrer's code pre-filled.
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: (typeof ref === "string" ? ref : "").toUpperCase(),
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    if (!form.name || !form.mobile || !form.password) {
      setError(t("auth.register.errRequired"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("auth.register.errMismatch"));
      return;
    }
    if (!agreed) {
      setError(t("auth.register.errTerms"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { accessToken, refreshToken } = await authApi.register({
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        password: form.password,
        referralCode: form.referralCode.trim() || undefined,
      });
      await SecureStore.setItemAsync("accessToken", accessToken);
      dispatch(setTokens({ accessToken, refreshToken, userId: "" }));
      // Email on file → verify it first (the server already sent the code).
      if (form.email.trim())
        router.replace({
          pathname: "/(auth)/verify-email",
          params: { email: form.email.trim() },
        });
      else router.replace("/(app)/(home)");
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ?? t("auth.register.failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const icon = (n: keyof typeof Ionicons.glyphMap) => (
    <Ionicons name={n} size={19} color={colors.text.tertiary} />
  );

  return (
    <View style={styles.root}>
      <View style={styles.blob} />
      <AppHeader title={t("auth.register.header")} />
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
            style={{ marginBottom: 24 }}
          >
            {t("auth.register.intro")}
          </Txt>

          {error ? (
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.errorBox}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Input
            label={t("auth.register.name")}
            placeholder={t("auth.register.namePlaceholder")}
            value={form.name}
            onChangeText={set("name")}
            leftIcon={icon("person-outline")}
          />
          <Input
            label={t("auth.register.mobile")}
            placeholder={t("auth.register.mobilePlaceholder")}
            value={form.mobile}
            onChangeText={set("mobile")}
            keyboardType="phone-pad"
            leftIcon={icon("call-outline")}
          />
          <Input
            label={t("auth.register.email")}
            placeholder={t("auth.register.emailPlaceholder")}
            value={form.email}
            onChangeText={set("email")}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={icon("mail-outline")}
          />
          <Input
            label={t("auth.register.password")}
            placeholder={t("auth.register.passwordPlaceholder")}
            value={form.password}
            onChangeText={set("password")}
            isPassword
            leftIcon={icon("lock-closed-outline")}
          />
          <Input
            label={t("auth.register.confirmPassword")}
            placeholder={t("auth.register.confirmPasswordPlaceholder")}
            value={form.confirmPassword}
            onChangeText={set("confirmPassword")}
            isPassword
            leftIcon={icon("shield-checkmark-outline")}
          />
          <Input
            label={t("auth.register.referral")}
            placeholder={t("auth.register.referralPlaceholder")}
            value={form.referralCode}
            onChangeText={(v: string) =>
              setForm((f) => ({ ...f, referralCode: v.toUpperCase() }))
            }
            autoCapitalize="characters"
            leftIcon={icon("gift-outline")}
          />

          <AnimatedPressable
            haptic="light"
            onPress={() => setAgreed((a) => !a)}
            style={styles.termsRow}
          >
            <View style={[styles.checkbox, agreed && styles.checked]}>
              {agreed && <Ionicons name="checkmark" size={15} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              {t("auth.register.agreePrefix")}
              <Text style={styles.link}>{t("auth.register.terms")}</Text>
              {t("auth.register.and")}
              <Text style={styles.link}>{t("auth.register.privacy")}</Text>
            </Text>
          </AnimatedPressable>

          <Button
            label={t("auth.register.submit")}
            onPress={handleRegister}
            loading={loading}
            size="lg"
          />

          <View style={styles.loginRow}>
            <Txt variant="body" color={colors.text.secondary}>
              {t("auth.register.haveAccount")}
            </Txt>
            <AnimatedPressable
              haptic={false}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.loginLink}>{t("auth.register.signIn")}</Text>
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
    blob: {
      position: "absolute",
      top: -80,
      right: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(139,187,233,0.10)",
    },
    scroll: { paddingHorizontal: Space.xxl, paddingBottom: 50, paddingTop: 8 },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.errorSoft,
      borderRadius: Radius.md,
      padding: 12,
      marginBottom: 18,
    },
    errorText: { ...Type.bodySm, color: c.error, flex: 1 },
    termsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 26,
      marginTop: 4,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checked: { backgroundColor: c.teal, borderColor: c.teal },
    termsText: { flex: 1, ...Type.bodySm, color: c.text.secondary },
    link: { fontFamily: Fonts.semibold, color: c.teal },
    loginRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 26,
    },
    loginLink: { ...Type.body, fontFamily: Fonts.bold, color: c.teal },
  });
