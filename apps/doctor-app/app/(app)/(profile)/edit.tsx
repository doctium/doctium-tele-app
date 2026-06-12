import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  Gradients,
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Input } from "../../../src/components/common/Input";
import { Button } from "../../../src/components/common/Button";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchDoctorProfile } from "../../../src/store/slices/doctorSlice";
import { doctorApi } from "../../../src/api/doctor.api";
import { SPOKEN_LANGUAGES } from "../../../src/constants/languages";

async function pickDataUrl(
  aspect: [number, number],
  quality: number,
): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect,
    quality,
    base64: true,
  });
  const a = res.assets?.[0];
  if (res.canceled || !a?.base64) return null;
  return `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}`;
}

export default function DoctorEditProfileScreen() {
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { profile } = useAppSelector((s) => s.doctor);
  const [form, setForm] = useState({
    name: "",
    designation: "",
    yourSelf: "",
    language: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [busyBanner, setBusyBanner] = useState(false);

  useEffect(() => {
    if (profile)
      setForm({
        name: profile.name ?? "",
        designation: profile.designation ?? "",
        yourSelf: profile.yourSelf ?? "",
        language: profile.language ?? [],
      });
  }, [profile]);

  const set = (k: "name" | "designation" | "yourSelf") => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleLanguage = (code: string) =>
    setForm((f) => ({
      ...f,
      language: f.language.includes(code)
        ? f.language.filter((c) => c !== code)
        : [...f.language, code],
    }));

  const changeAvatar = async () => {
    const dataUrl = await pickDataUrl([1, 1], 0.5);
    if (!dataUrl) return;
    setBusyAvatar(true);
    try {
      await doctorApi.updateAvatar(dataUrl);
      await dispatch(fetchDoctorProfile());
    } catch {
    } finally {
      setBusyAvatar(false);
    }
  };

  const changeBanner = async () => {
    const dataUrl = await pickDataUrl([3, 1], 0.6);
    if (!dataUrl) return;
    setBusyBanner(true);
    try {
      await doctorApi.updateBanner(dataUrl);
      await dispatch(fetchDoctorProfile());
    } catch {
    } finally {
      setBusyBanner(false);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      await doctorApi.updateProfile(form as Record<string, unknown>);
      await dispatch(fetchDoctorProfile());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.back();
      }, 1200);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Edit profile" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Banner (1:3) */}
          <Text style={styles.fieldLabel}>Profile banner</Text>
          <AnimatedPressable
            haptic="light"
            onPress={changeBanner}
            style={styles.bannerWrap}
          >
            {profile?.bannerImage ? (
              <Image
                source={{ uri: profile.bannerImage }}
                style={styles.bannerImg}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={Gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerImg}
              >
                <Ionicons
                  name="image-outline"
                  size={26}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.bannerHint}>
                  Add a banner (3:1) — shown on your public profile
                </Text>
              </LinearGradient>
            )}
            <View style={styles.bannerEdit}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
            {busyBanner ? (
              <View style={styles.bannerLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </AnimatedPressable>

          {/* Avatar */}
          <AnimatedPressable
            haptic="light"
            onPress={changeAvatar}
            style={styles.avatarWrap}
          >
            <Avatar uri={profile?.image} name={profile?.name} size={88} ring />
            <LinearGradient
              colors={Gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.camBadge}
            >
              <Ionicons name="camera" size={15} color="#fff" />
            </LinearGradient>
            {busyAvatar ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </AnimatedPressable>

          {success ? (
            <Animated.View entering={FadeIn} style={styles.success}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.success}
              />
              <Txt variant="label" color={colors.success}>
                Profile updated
              </Txt>
            </Animated.View>
          ) : null}

          <Input
            label="Full name"
            value={form.name}
            onChangeText={set("name")}
            placeholder="Dr. Jane Doe"
            leftIcon={
              <Ionicons
                name="person-outline"
                size={19}
                color={colors.text.tertiary}
              />
            }
          />
          <Input
            label="Title / speciality"
            value={form.designation}
            onChangeText={set("designation")}
            placeholder="e.g. Consultant — Cardiology"
            leftIcon={
              <Ionicons
                name="ribbon-outline"
                size={19}
                color={colors.text.tertiary}
              />
            }
          />
          <Input
            label="About you"
            value={form.yourSelf}
            onChangeText={set("yourSelf")}
            placeholder="Tell patients about your experience, approach and areas of focus…"
            multiline
          />

          <Text style={styles.fieldLabel}>Languages you speak</Text>
          <Text style={styles.langHint}>
            Patients can filter doctors by language — pick every language you
            can consult in.
          </Text>
          <View style={styles.chipsWrap}>
            {SPOKEN_LANGUAGES.map((l) => {
              const selected = form.language.includes(l.code);
              return (
                <AnimatedPressable
                  key={l.code}
                  haptic="light"
                  onPress={() => toggleLanguage(l.code)}
                  style={[styles.chip, selected && styles.chipOn]}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                  <Text
                    style={[styles.chipText, selected && styles.chipTextOn]}
                  >
                    {l.native}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <Button
            label="Save changes"
            onPress={save}
            loading={loading}
            size="lg"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xxl, paddingBottom: 40, paddingTop: 4 },
    fieldLabel: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: c.text.secondary,
      marginBottom: 8,
      marginLeft: 2,
    },
    langHint: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: -4,
      marginBottom: 12,
      marginLeft: 2,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
      marginBottom: 20,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.round,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipOn: {
      backgroundColor: c.interactive,
      borderColor: c.interactive,
    },
    chipText: { ...Type.bodySm, color: c.text.secondary },
    chipTextOn: { color: "#fff", fontFamily: Fonts.bold },
    bannerWrap: {
      width: "100%",
      aspectRatio: 3,
      borderRadius: Radius.lg,
      overflow: "hidden",
      position: "relative",
    },
    bannerImg: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 20,
    },
    bannerHint: {
      ...Type.caption,
      color: "rgba(255,255,255,0.92)",
      textAlign: "center",
    },
    bannerEdit: {
      position: "absolute",
      bottom: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(11,27,48,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    bannerLoading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(11,27,48,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarWrap: {
      alignSelf: "center",
      position: "relative",
      marginTop: -44,
      marginBottom: 22,
    },
    avatarLoading: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 44,
      backgroundColor: "rgba(11,27,48,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    camBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2.5,
      borderColor: c.background,
      ...Shadow.cta,
    },
    success: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.successSoft,
      borderRadius: Radius.md,
      paddingVertical: 12,
      marginBottom: 18,
    },
  });
