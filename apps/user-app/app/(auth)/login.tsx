import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { AnimatedPressable } from "../../src/components/ui";
import { AuroraField } from "../../src/components/motion";
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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!mobile.trim() || !password.trim()) {
      setError(t("auth.login.fillAll"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { accessToken, refreshToken } = await authApi.login({
        mobile,
        password,
      });
      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      dispatch(setTokens({ accessToken, refreshToken, userId: "" }));
      router.replace("/(app)/(home)");
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? t("auth.login.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Atmosphere — slow-breathing aurora blobs */}
      <AuroraField
        blobs={[
          {
            size: 240,
            color: "rgba(19,49,87,0.08)",
            top: -90,
            right: -60,
            duration: 11000,
            driftX: 34,
            driftY: 26,
          },
          {
            size: 220,
            color: "rgba(139,187,233,0.16)",
            top: 40,
            left: -80,
            duration: 14000,
            driftX: 42,
            driftY: 30,
          },
          {
            size: 160,
            color: "rgba(46,124,194,0.10)",
            bottom: -40,
            right: -30,
            duration: 17000,
            driftX: 38,
            driftY: 24,
          },
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            style={styles.header}
          >
            <View style={styles.logo}>
              <Image
                source={require("../../assets/brand/doctium-logo-lightbg.png")}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>{t("auth.login.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.login.subtitle")}</Text>
          </Animated.View>

          {error ? (
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.errorBox}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(90).springify().damping(18)}
          >
            <Input
              label={t("auth.login.mobile")}
              placeholder={t("auth.login.mobilePlaceholder")}
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              autoComplete="tel"
              leftIcon={
                <Ionicons
                  name="call-outline"
                  size={19}
                  color={colors.text.tertiary}
                />
              }
            />
            <Input
              label={t("auth.login.password")}
              placeholder={t("auth.login.passwordPlaceholder")}
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={colors.text.tertiary}
                />
              }
            />

            <AnimatedPressable
              haptic={false}
              onPress={() => router.push("/(auth)/forgot-password")}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>{t("auth.login.forgot")}</Text>
            </AnimatedPressable>

            <Button
              label={t("auth.login.signIn")}
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={{ marginTop: 8 }}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(160).springify().damping(18)}
          >
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>{t("common.or")}</Text>
              <View style={styles.line} />
            </View>

            <AnimatedPressable
              haptic="light"
              onPress={() => router.push("/(auth)/otp-login")}
              style={styles.otpBtn}
            >
              <Ionicons
                name="chatbox-ellipses-outline"
                size={19}
                color={colors.navy}
              />
              <Text style={styles.otpText}>{t("auth.login.otp")}</Text>
            </AnimatedPressable>

            <View style={styles.registerRow}>
              <Text style={styles.registerGrey}>
                {t("auth.login.noAccount")}
              </Text>
              <AnimatedPressable
                haptic={false}
                onPress={() => router.push("/(auth)/register")}
              >
                <Text style={styles.registerLink}>
                  {t("auth.login.signUp")}
                </Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1, paddingHorizontal: Space.xxl, paddingBottom: 40 },
    header: { alignItems: "center", marginBottom: 36 },
    logo: {
      width: 78,
      height: 78,
      borderRadius: Radius.xl,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
      backgroundColor: "#fff",
      padding: 13,
      ...Shadow.card,
    },
    logoImg: { width: "100%", height: "100%" },
    title: { ...Type.hero, color: c.text.primary },
    subtitle: {
      ...Type.body,
      color: c.text.secondary,
      marginTop: 8,
      textAlign: "center",
    },
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
    forgot: {
      alignSelf: "flex-end",
      marginTop: 2,
      marginBottom: 22,
      paddingVertical: 2,
    },
    forgotText: { ...Type.label, color: c.interactive },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginVertical: 24,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    dividerText: { ...Type.caption, color: c.text.tertiary },
    otpBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 56,
      borderRadius: Radius.lg,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    otpText: {
      fontFamily: Fonts.bold,
      fontSize: 15,
      color: c.navy,
      letterSpacing: -0.2,
    },
    registerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 30,
    },
    registerGrey: { ...Type.body, color: c.text.secondary },
    registerLink: {
      ...Type.body,
      fontFamily: Fonts.bold,
      color: c.interactive,
    },
  });
