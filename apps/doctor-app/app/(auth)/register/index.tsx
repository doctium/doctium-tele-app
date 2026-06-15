import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Input } from "../../../src/components/common/Input";
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
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
import { apiClient } from "../../../src/api/client";
import { SPOKEN_LANGUAGES } from "../../../src/constants/languages";

const SPECIALITIES = [
  "General Practitioner",
  "Senior Registrar",
  "Consultant",
] as const;

export default function DoctorRegisterScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [consultantSpeciality, setConsultantSpeciality] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleLanguage = (code: string) =>
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const icon = (n: keyof typeof Ionicons.glyphMap) => (
    <Ionicons name={n} size={19} color={colors.text.tertiary} />
  );

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim())
      return setError("Enter your first and last name");
    if (!email.trim()) return setError("Enter your email address");
    if (!phone.trim()) return setError("Enter your phone number");
    if (password.length < 8)
      return setError("Password must be at least 8 characters");
    if (!speciality) return setError("Select your speciality");
    if (speciality === "Consultant" && !consultantSpeciality.trim())
      return setError("Enter your consultant speciality");

    setError("");
    setLoading(true);
    try {
      const res = (await apiClient.post("/auth/doctor/register/send-otp", {
        email: email.trim(),
        phone: phone.trim(),
      })) as {
        data: { sent: boolean; devEmailCode?: string; devPhoneCode?: string };
      };

      router.push({
        pathname: "/(auth)/register/verify",
        params: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          speciality,
          consultantSpeciality: consultantSpeciality.trim(),
          languages: languages.join(","),
          devEmailCode: res.data?.devEmailCode ?? "",
          devPhoneCode: res.data?.devPhoneCode ?? "",
        },
      });
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ?? "Could not start registration",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Create account" />
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
            style={{ marginBottom: 22 }}
          >
            Join Doctium to manage your practice. New registrations are reviewed
            by our team before you go live.
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

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input
                label="First name"
                placeholder="Jane"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Last name"
                placeholder="Doe"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <Input
            label="Email address"
            placeholder="doctor@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={icon("mail-outline")}
          />
          <Text style={styles.hint}>
            Only your email address will be used to sign in.
          </Text>

          <Input
            label="Phone number"
            placeholder="0800 000 0000"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={icon("call-outline")}
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon={icon("lock-closed-outline")}
          />

          <Text style={styles.fieldLabel}>Speciality</Text>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.select}>
            <Ionicons
              name="medical-outline"
              size={19}
              color={colors.text.tertiary}
            />
            <Text
              style={[
                styles.selectText,
                !speciality && { color: colors.text.tertiary },
              ]}
              numberOfLines={1}
            >
              {speciality || "Select your speciality"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={colors.text.tertiary}
            />
          </Pressable>

          {speciality === "Consultant" ? (
            <Input
              label="Your speciality"
              placeholder="e.g. Cardiology, Paediatrics"
              value={consultantSpeciality}
              onChangeText={setConsultantSpeciality}
              autoCapitalize="words"
              leftIcon={icon("ribbon-outline")}
            />
          ) : null}

          <Text style={styles.fieldLabel}>Languages you speak</Text>
          <Pressable
            onPress={() => setLangPickerOpen(true)}
            style={styles.select}
          >
            <Ionicons
              name="language-outline"
              size={19}
              color={colors.text.tertiary}
            />
            <Text
              style={[
                styles.selectText,
                languages.length === 0 && { color: colors.text.tertiary },
              ]}
              numberOfLines={1}
            >
              {languages.length
                ? SPOKEN_LANGUAGES.filter((l) => languages.includes(l.code))
                    .map((l) => l.native)
                    .join(", ")
                : "Select the languages you speak"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={colors.text.tertiary}
            />
          </Pressable>
          <Text style={styles.hint}>
            Patients can find you by the languages you speak. You can change
            this later.
          </Text>

          <Button
            label="Continue"
            onPress={submit}
            loading={loading}
            size="lg"
            style={{ marginTop: 14 }}
          />

          <View style={styles.signinRow}>
            <Text style={styles.greyText}>Already have an account? </Text>
            <AnimatedPressable
              haptic={false}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.link}>Sign in</Text>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select speciality</Text>
            {SPECIALITIES.map((s) => (
              <Pressable
                key={s}
                style={styles.option}
                onPress={() => {
                  setSpeciality(s);
                  setPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    speciality === s && {
                      color: colors.interactive,
                      fontFamily: Fonts.bold,
                    },
                  ]}
                >
                  {s}
                </Text>
                {speciality === s ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.interactive}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={langPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setLangPickerOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Languages you speak</Text>
            {SPOKEN_LANGUAGES.map((l) => {
              const selected = languages.includes(l.code);
              return (
                <Pressable
                  key={l.code}
                  style={styles.option}
                  onPress={() => toggleLanguage(l.code)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && {
                        color: colors.interactive,
                        fontFamily: Fonts.bold,
                      },
                    ]}
                  >
                    {l.native}
                    {l.native !== l.label ? `  ·  ${l.label}` : ""}
                  </Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.interactive}
                    />
                  ) : null}
                </Pressable>
              );
            })}
            <Button
              label="Done"
              onPress={() => setLangPickerOpen(false)}
              size="md"
              style={{ marginTop: 8 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xxl, paddingBottom: 48 },
    row: { flexDirection: "row", gap: 12 },
    hint: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: -6,
      marginBottom: 14,
      marginLeft: 4,
    },
    fieldLabel: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: c.text.secondary,
      marginBottom: 8,
      marginLeft: 2,
      letterSpacing: -0.1,
    },
    select: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 14,
      height: 54,
      marginBottom: 16,
    },
    selectText: { flex: 1, ...Type.body, color: c.text.primary },
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
    signinRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 24,
    },
    greyText: { ...Type.body, color: c.text.secondary },
    link: { ...Type.body, fontFamily: Fonts.bold, color: c.interactive },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(8,18,32,0.45)",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 10,
      ...Shadow.floating,
    },
    modalTitle: {
      ...Type.label,
      color: c.text.tertiary,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 15,
      borderRadius: Radius.md,
    },
    optionText: { ...Type.bodyMed, color: c.text.primary },
  });
