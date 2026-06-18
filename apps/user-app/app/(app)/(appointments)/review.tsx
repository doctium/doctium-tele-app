import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import {
  Gradients,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { StarRating } from "../../../src/components/common/StarRating";
import { AppHeader, Txt } from "../../../src/components/ui";
import { reviewsApi } from "../../../src/api/reviews.api";

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function ReviewScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const { appointmentId, doctorId } = useLocalSearchParams<{
    appointmentId: string;
    doctorId: string;
  }>();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (rating === 0) {
      setError(t("booking.review.selectRating"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await reviewsApi.create({
        doctorId,
        appointmentId,
        review: text,
        rating,
      });
      setDone(true);
      setTimeout(() => router.back(), 1500);
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message ??
          t("booking.review.submitFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.root, styles.center]}>
        <Animated.View entering={FadeIn.springify()} style={styles.doneWrap}>
          <LinearGradient
            colors={Gradients.teal}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneIcon}
          >
            <Ionicons name="checkmark" size={40} color="#fff" />
          </LinearGradient>
          <Txt variant="hero" center style={{ marginTop: 22 }}>
            {t("booking.review.thankYou")}
          </Txt>
          <Txt
            variant="body"
            center
            color={colors.text.secondary}
            style={{ marginTop: 8 }}
          >
            {t("booking.review.thankYouSub")}
          </Txt>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title={t("booking.review.title")} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            style={styles.prompt}
          >
            <Txt variant="h1" center>
              {t("booking.review.prompt")}
            </Txt>
            <Txt
              variant="body"
              center
              color={colors.text.secondary}
              style={{ marginTop: 8 }}
            >
              {t("booking.review.promptSub")}
            </Txt>
          </Animated.View>

          <View style={styles.starsRow}>
            <StarRating rating={rating} onRate={setRating} size={26} />
          </View>
          <Text style={styles.ratingLabel}>
            {LABELS[rating] ? t(`booking.review.rating${LABELS[rating]}`) : " "}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={t("booking.review.commentPlaceholder")}
            placeholderTextColor={colors.text.tertiary}
            value={text}
            onChangeText={setText}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={t("booking.review.submit")}
            onPress={submit}
            loading={loading}
            size="lg"
            disabled={rating === 0}
            style={{ marginTop: 20 }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center", padding: 32 },
    doneWrap: { alignItems: "center" },
    doneIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.cta,
    },
    content: { flex: 1, paddingHorizontal: Space.xxl, paddingTop: 24 },
    prompt: { marginBottom: 36 },
    starsRow: { alignItems: "center", justifyContent: "center" },
    ratingLabel: {
      ...Type.h3,
      color: c.teal,
      textAlign: "center",
      marginTop: 16,
      marginBottom: 28,
      height: 24,
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 16,
      ...Type.bodyMed,
      color: c.text.primary,
      minHeight: 120,
      textAlignVertical: "top",
      ...Shadow.card,
    },
    error: {
      ...Type.bodySm,
      color: c.error,
      textAlign: "center",
      marginTop: 14,
    },
  });
