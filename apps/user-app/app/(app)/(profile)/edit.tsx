import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  Palette,
  Gradients,
  Radius,
  Shadow,
  Space,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Input } from "../../../src/components/common/Input";
import { Button } from "../../../src/components/common/Button";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchProfile } from "../../../src/store/slices/userSlice";
import { usersApi } from "../../../src/api/users.api";

export default function EditProfileScreen() {
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((s) => s.user);
  const [form, setForm] = useState({
    name: "",
    email: "",
    dob: "",
    gender: "",
    bio: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    if (profile)
      setForm({
        name: profile.name,
        email: profile.email,
        dob: profile.dob ?? "",
        gender: profile.gender ?? "",
        bio: (profile as { bio?: string }).bio ?? "",
      });
  }, [profile]);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const MAX_AVATAR_BYTES = 1024 * 1024; // 1MB cap

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    const a = res.assets?.[0];
    if (res.canceled || !a?.base64) return;

    // Enforce the 1MB cap (base64 decodes to ~3/4 of its length in bytes).
    const sizeBytes = Math.floor((a.base64.length * 3) / 4);
    if (sizeBytes > MAX_AVATAR_BYTES) {
      Alert.alert(
        "Image too large",
        "Please choose a picture under 1MB, or crop it smaller and try again.",
      );
      return;
    }

    setUploadingAvatar(true);
    try {
      await usersApi.updateAvatar(
        `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}`,
      );
      await dispatch(fetchProfile());
    } catch {
      /* interceptor surfaces errors */
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      await usersApi.updateProfile(form as Record<string, unknown>);
      await dispatch(fetchProfile());
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
          <AnimatedPressable
            haptic="light"
            onPress={pickImage}
            style={styles.avatarWrap}
          >
            <Avatar uri={profile?.image} name={profile?.name} size={92} ring />
            <LinearGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.camBadge}
            >
              <Ionicons name="camera" size={15} color="#fff" />
            </LinearGradient>
            {uploadingAvatar ? (
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
                color={colors.tealDeep}
              />
              <Txt variant="label" color={colors.tealDeep}>
                Profile updated
              </Txt>
            </Animated.View>
          ) : null}

          <Input
            label="Full name"
            value={form.name}
            onChangeText={set("name")}
            placeholder="Your full name"
            leftIcon={
              <Ionicons
                name="person-outline"
                size={19}
                color={colors.text.tertiary}
              />
            }
          />
          <Input
            label="Email"
            value={form.email}
            onChangeText={set("email")}
            placeholder="email@example.com"
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
            label="Date of birth"
            value={form.dob}
            onChangeText={set("dob")}
            placeholder="YYYY-MM-DD"
            leftIcon={
              <Ionicons
                name="calendar-outline"
                size={19}
                color={colors.text.tertiary}
              />
            }
          />
          <Input
            label="Gender"
            value={form.gender}
            onChangeText={set("gender")}
            placeholder="Male / Female / Other"
            leftIcon={
              <Ionicons
                name="male-female-outline"
                size={19}
                color={colors.text.tertiary}
              />
            }
          />
          <Input
            label="Bio"
            value={form.bio}
            onChangeText={set("bio")}
            placeholder="A short bio about yourself…"
            multiline
          />

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
    avatarWrap: { alignSelf: "center", position: "relative", marginBottom: 26 },
    avatarLoading: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 46,
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
      backgroundColor: c.tealSoft,
      borderRadius: Radius.md,
      paddingVertical: 12,
      marginBottom: 18,
    },
  });
