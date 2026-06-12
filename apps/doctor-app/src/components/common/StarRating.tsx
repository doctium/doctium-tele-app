import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts, Palette, useColors, useThemedStyles } from "../../theme";

interface Props {
  rating: number;
  maxStars?: number;
  size?: number;
  onRate?: (rating: number) => void;
  showCount?: boolean;
  count?: number;
}

const GOLD = "#FBBF24";

export function StarRating({
  rating,
  maxStars = 5,
  size = 14,
  onRate,
  showCount,
  count,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (onRate) {
    return (
      <View style={styles.row}>
        {Array.from({ length: maxStars }, (_, i) => {
          const active = i < Math.round(rating);
          return (
            <TouchableOpacity key={i} onPress={() => onRate(i + 1)} hitSlop={6}>
              <Ionicons
                name={active ? "star" : "star-outline"}
                size={size * 1.6}
                color={active ? GOLD : colors.text.tertiary}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={GOLD} />
      <Text style={[styles.value, { fontSize: size }]}>
        {(rating ?? 0).toFixed(1)}
      </Text>
      {showCount && (
        <Text style={[styles.count, { fontSize: size - 1 }]}>
          ({count ?? 0})
        </Text>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 4 },
    value: {
      fontFamily: Fonts.bold,
      color: c.text.primary,
      letterSpacing: -0.2,
    },
    count: { fontFamily: Fonts.medium, color: c.text.tertiary },
  });
