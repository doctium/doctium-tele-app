import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  Gradients,
  Shadow,
  Radius,
  Motion,
  Palette,
  useTheme,
  useThemedStyles,
} from "../../theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, [IoniconName, IoniconName]> = {
  "(home)": ["home", "home-outline"],
  "(appointments)": ["calendar", "calendar-outline"],
  "(clips)": ["film", "film-outline"],
  "(chat)": ["chatbubble-ellipses", "chatbubble-ellipses-outline"],
  "(profile)": ["person", "person-outline"],
};

const PAD = 8;
const BAR_H = 62;
const PILL_H = 46;
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

/** Signature floating glass tab bar with a fluid spring indicator pill. */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  // Only render the real tabs (some groups like (doctors)/(wallet) live in the
  // same navigator but must not appear in the bar).
  const tabs = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => ICONS[route.name]);
  const count = tabs.length;
  const activePos = tabs.findIndex((t) => t.index === state.index);
  const slot = width > 0 && count > 0 ? (width - PAD * 2) / count : 0;
  const pillW = slot > 0 ? Math.min(slot - 6, 62) : 0;

  const pos = useSharedValue(Math.max(activePos, 0));
  useEffect(() => {
    if (activePos >= 0) pos.value = withSpring(activePos, Motion.spring.fluid);
  }, [activePos]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: PAD + pos.value * slot + (slot - pillW) / 2 }],
    width: pillW,
  }));

  // Hide the bar on pushed detail screens (nested stack depth > 0) or
  // non-tab groups so it never collides with a screen's own bottom CTA.
  const focusedRoute = state.routes[state.index] as {
    state?: { index?: number };
  };
  const nestedIndex = focusedRoute?.state?.index ?? 0;
  if (activePos < 0 || nestedIndex > 0) return null;

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom ? insets.bottom - 2 : 14 },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.shadow}>
        <BlurView
          intensity={42}
          tint={isDark ? "dark" : "light"}
          style={styles.bar}
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width)
          }
        >
          {slot > 0 && activePos >= 0 && (
            <AnimatedGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.indicator, indicatorStyle]}
            />
          )}
          {tabs.map(({ route, index }) => {
            const focused = state.index === index;
            const [active, inactive] = ICONS[route.name] ?? [
              "ellipse",
              "ellipse-outline",
            ];
            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented)
                navigation.navigate(route.name);
            };
            return (
              <Pressable
                key={route.key}
                style={styles.tab}
                onPress={onPress}
                hitSlop={4}
              >
                <Ionicons
                  name={focused ? active : inactive}
                  size={23}
                  color={
                    focused
                      ? "#FFFFFF"
                      : isDark
                        ? "rgba(255,255,255,0.50)"
                        : "rgba(19,49,87,0.42)"
                  }
                />
              </Pressable>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
    },
    shadow: {
      borderRadius: Radius.xxl,
      backgroundColor: c.glass,
      ...Shadow.floating,
    },
    bar: {
      flexDirection: "row",
      height: BAR_H,
      borderRadius: Radius.xxl,
      overflow: "hidden",
      alignItems: "center",
      paddingHorizontal: PAD,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.glassBorder,
    },
    indicator: {
      position: "absolute",
      top: (BAR_H - PILL_H) / 2,
      height: PILL_H,
      borderRadius: Radius.lg,
      left: 0,
      ...Shadow.cta,
    },
    tab: {
      flex: 1,
      height: BAR_H,
      alignItems: "center",
      justifyContent: "center",
    },
  });
