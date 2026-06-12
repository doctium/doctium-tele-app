import React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Palette, useThemedStyles } from "../../../src/theme";
import { AppHeader } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";

export default function MyReviewsScreen() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      <AppHeader title="My reviews" />
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="star-outline"
          title="No reviews yet"
          description="After a completed consultation, you can rate your doctor and your reviews will appear here."
          actionLabel="Find a doctor"
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
