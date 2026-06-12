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
import Animated, { FadeInDown } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { AnimatedPressable, Txt } from "../../src/components/ui";
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
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { setTokens } from "../../src/store/slices/authSlice";
import { apiClient } from "../../src/api/client";

export default function DoctorLoginScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = (await apiClient.post("/auth/doctor/login", {
        email,
        password,
      })) as { data: { accessToken: string; refreshToken: string } };
      await SecureStore.setItemAsync("doctorAccessToken", res.data.accessToken);
      dispatch(setTokens({ accessToken: res.data.accessToken, doctorId: "" }));
      router.replace("/(app)/(dashboard)");
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 44 },
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
            <Txt variant="hero">Doctor portal</Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={{ marginTop: 8 }}
              center
            >
              Sign in to manage your practice
            </Txt>
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
              label="Email"
              placeholder="doctor@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color={colors.text.tertiary}
                />
              }
            />
            <Input
              label="Password"
              placeholder="Enter your password"
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
            <Button
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={{ marginTop: 8 }}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            style={styles.registerRow}
          >
            <Text style={styles.registerGrey}>New to Doctium? </Text>
            <AnimatedPressable
              haptic={false}
              onPress={() => router.push("/(auth)/register")}
            >
              <Text style={styles.registerLink}>Sign up as a Doctor</Text>
            </AnimatedPressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    blobA: {
      position: "absolute",
      top: -90,
      right: -60,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: "rgba(139,187,233,0.12)",
    },
    blobB: {
      position: "absolute",
      top: 40,
      left: -80,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(139,187,233,0.16)",
    },
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
    registerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 28,
    },
    registerGrey: { ...Type.body, color: c.text.secondary },
    registerLink: {
      ...Type.body,
      fontFamily: Fonts.bold,
      color: c.interactive,
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
    note: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 28,
    },
  });
