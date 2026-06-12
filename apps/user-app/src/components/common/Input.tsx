import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Radius,
  Space,
  Palette,
  useColors,
  useThemedStyles,
} from "../../theme";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  isPassword,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);
  const focus = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [
        error ? colors.error : colors.border,
        error ? colors.error : colors.interactive,
      ],
    ),
    shadowOpacity: 0.1 * focus.value,
  }));

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[styles.inputRow, animStyle]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.text.tertiary}
          secureTextEntry={isPassword && !show}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: 160 });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: 160 });
            onBlur?.(e);
          }}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => setShow((s) => !s)}
            hitSlop={8}
          >
            <Ionicons
              name={show ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        ) : (
          rightIcon && <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { marginBottom: Space.lg },
    label: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: c.text.secondary,
      marginBottom: 8,
      marginLeft: 2,
      letterSpacing: -0.1,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      backgroundColor: c.surface,
      minHeight: 56,
      shadowColor: c.interactive,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 14,
      elevation: 0,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.medium,
      color: c.text.primary,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    iconLeft: { paddingLeft: 14 },
    iconRight: { paddingHorizontal: 14 },
    error: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      color: c.error,
      marginTop: 6,
      marginLeft: 4,
    },
  });
