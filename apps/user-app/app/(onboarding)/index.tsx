import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Button } from "../../src/components/common/Button";
import { AnimatedPressable, Txt } from "../../src/components/ui";
import { Palette, Space, useColors, useThemedStyles } from "../../src/theme";
import { setOnboardingSeen } from "../../src/utils/onboardingPrefs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
};

export default function Onboarding() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const slides: Slide[] = [
    {
      icon: "medkit-outline",
      title: t("onboarding.slide1.title"),
      sub: t("onboarding.slide1.subtitle"),
    },
    {
      icon: "videocam-outline",
      title: t("onboarding.slide2.title"),
      sub: t("onboarding.slide2.subtitle"),
    },
    {
      icon: "document-text-outline",
      title: t("onboarding.slide3.title"),
      sub: t("onboarding.slide3.subtitle"),
    },
  ];
  const isLast = page === slides.length - 1;

  const finish = async () => {
    await setOnboardingSeen();
    router.replace("/(auth)/login");
  };
  const next = () => {
    if (isLast) return finish();
    scroller.current?.scrollTo({ x: width * (page + 1), animated: true });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={styles.root}>
      <View style={[styles.skipRow, { paddingTop: insets.top + 12 }]}>
        <AnimatedPressable haptic="light" onPress={finish}>
          <Txt variant="body" color={colors.text.secondary}>
            {t("onboarding.skip")}
          </Txt>
        </AnimatedPressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {slides.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.badge}>
              <Ionicons name={s.icon} size={64} color={colors.teal} />
            </View>
            <Txt variant="h1" color={colors.text.primary} style={styles.title}>
              {s.title}
            </Txt>
            <Txt
              variant="body"
              color={colors.text.secondary}
              style={styles.sub}
            >
              {s.sub}
            </Txt>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
        <Button
          label={isLast ? t("onboarding.getStarted") : t("onboarding.next")}
          onPress={next}
          size="lg"
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    skipRow: {
      alignItems: "flex-end",
      paddingHorizontal: Space.xxl,
      paddingBottom: 4,
    },
    slide: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Space.xxl,
      gap: 16,
    },
    badge: {
      width: 132,
      height: 132,
      borderRadius: 66,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.tealSoft,
      marginBottom: 14,
    },
    title: { textAlign: "center" },
    sub: { textAlign: "center", lineHeight: 22, paddingHorizontal: Space.md },
    footer: { paddingHorizontal: Space.xxl, gap: 22 },
    dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
    dotActive: { width: 22, backgroundColor: c.teal },
  });
