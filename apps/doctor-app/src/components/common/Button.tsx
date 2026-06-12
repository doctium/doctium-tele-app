import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedPressable } from "../ui/AnimatedPressable";
import {
  Gradients,
  Fonts,
  Radius,
  Shadow,
  Space,
  useColors,
} from "../../theme";

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const HEIGHTS = { sm: 44, md: 54, lg: 60 } as const;
const FSIZE = { sm: 14, md: 16, lg: 17 } as const;

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  size = "md",
  icon,
  fullWidth = true,
  style,
  textStyle,
}: Props) {
  const colors = useColors();
  const isDisabled = disabled || loading;
  const height = HEIGHTS[size];
  const onColor =
    variant === "primary" || variant === "secondary" ? "#fff" : colors.navy;

  const content = loading ? (
    <ActivityIndicator color={onColor} />
  ) : (
    <View style={styles.row}>
      {icon}
      <Text
        style={[
          {
            fontFamily: Fonts.bold,
            fontSize: FSIZE[size],
            color: onColor,
            letterSpacing: -0.2,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const fill: ViewStyle = {
    height,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.xxl,
    width: fullWidth ? "100%" : undefined,
  };

  if (variant === "primary") {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        haptic="medium"
        style={[
          {
            borderRadius: Radius.lg,
            width: fullWidth ? "100%" : undefined,
            opacity: isDisabled ? 0.55 : 1,
          },
          !isDisabled && Shadow.cta,
          style,
        ]}
      >
        <LinearGradient
          colors={Gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={fill}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const variantStyle: ViewStyle =
    variant === "secondary"
      ? { backgroundColor: colors.navy }
      : variant === "outline"
        ? {
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: colors.navy,
          }
        : { backgroundColor: "transparent" };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={variant === "secondary" ? "medium" : "light"}
      style={[
        fill,
        variantStyle,
        variant === "secondary" && !isDisabled && Shadow.raised,
        { opacity: isDisabled ? 0.55 : 1 },
        style,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
