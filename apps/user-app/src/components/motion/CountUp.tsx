import React, { useEffect } from "react";
import { StyleProp, TextInput, TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface Props {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Number that counts up to its value (stat blocks, prices, ratings).
 * Rendered through a non-editable TextInput so the digits update on the
 * UI thread without re-rendering React. Jumps straight to the value under
 * OS reduce-motion.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1000,
  delay = 0,
  style,
}: Props) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      v.value = value;
      return;
    }
    v.value = withDelay(
      delay,
      withTiming(value, { duration, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  const animatedProps = useAnimatedProps(() => {
    const text = `${prefix}${v.value.toFixed(decimals)}${suffix}`;
    return { text, defaultValue: text } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      style={[{ padding: 0, color: "#fff" }, style]}
    />
  );
}
