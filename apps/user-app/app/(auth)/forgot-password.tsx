import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { AppHeader, Txt } from "../../src/components/ui";
import {
  Palette,
  Radius,
  Shadow,
  Space,
  useColors,
  useThemedStyles,
} from "../../src/theme";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [mobile, setMobile] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
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

          <Txt variant="hero">{t("auth.forgot.title")}</Txt>
          <Txt
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: 8, marginBottom: 28 }}
          >
            {t("auth.forgot.subtitle")}
          </Txt>

          {sent ? (
            <Animated.View
              entering={FadeIn.springify()}
              style={styles.successCard}
            >
              <View style={styles.successIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={26}
                  color={colors.success}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="title">{t("auth.forgot.sentTitle")}</Txt>
                <Txt
                  variant="bodySm"
                  color={colors.text.secondary}
                  style={{ marginTop: 2 }}
                >
                  {t("auth.forgot.sentBody")}
                </Txt>
              </View>
            </Animated.View>
          ) : (
            <>
              <Input
                label={t("auth.forgot.mobileLabel")}
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
                label={t("auth.forgot.sendResetLink")}
                onPress={handleSend}
                loading={loading}
                size="lg"
                style={{ marginTop: 8 }}
              />
            </>
          )}

          {sent ? (
            <Button
              label={t("auth.forgot.backToSignIn")}
              variant="outline"
              onPress={() => router.replace("/(auth)/login")}
              size="lg"
              style={{ marginTop: 18 }}
            />
          ) : null}
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
      right: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(19,49,87,0.08)",
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
    successCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 18,
      backgroundColor: c.successSoft,
      borderRadius: Radius.xl,
    },
    successIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
  });
