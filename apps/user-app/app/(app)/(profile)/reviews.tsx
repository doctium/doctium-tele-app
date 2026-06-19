import React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Palette, useThemedStyles } from "../../../src/theme";
import { AppHeader } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";

export default function MyReviewsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <AppHeader title={t("reviews.title")} />
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="star-outline"
          title={t("reviews.emptyTitle")}
          description={t("reviews.emptyDescription")}
          actionLabel={t("reviews.findDoctor")}
          onAction={() => router.push("/(app)/(doctors)/search")}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
  });
