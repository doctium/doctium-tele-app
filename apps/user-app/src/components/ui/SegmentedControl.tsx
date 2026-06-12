import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Fonts,
  Motion,
  Palette,
  Radius,
  Shadow,
  useThemedStyles,
} from "../../theme";

const PAD = 4;

interface Props {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fluid segmented control — a navy pill that glides on a spring between
 * options instead of snapping. The app-wide pattern for tabbed filters.
 */
export function SegmentedControl({ options, value, onChange, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const idx = Math.max(
    options.findIndex((o) => o.key === value),
    0,
  );
  const pos = useSharedValue(idx);

  useEffect(() => {
    pos.value = withSpring(idx, Motion.spring.fluid);
  }, [idx]);

  const slot = width > 0 ? (width - PAD * 2) / options.length : 0;
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: PAD + pos.value * slot }],
    width: slot,
  }));

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {slot > 0 ? (
        <Animated.View style={[styles.indicator, indicatorStyle]} />
      ) : null}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={styles.item}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.key);
            }}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      height: 48,
      borderRadius: Radius.lg,
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    indicator: {
      position: "absolute",
      top: PAD,
      bottom: PAD,
      left: 0,
      borderRadius: Radius.md,
      backgroundColor: c.navy,
      ...Shadow.card,
    },
    item: {
      flex: 1,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
      paddingHorizontal: 6,
    },
    label: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
      letterSpacing: -0.1,
    },
    labelActive: { color: "#fff", fontFamily: Fonts.bold },
  });
