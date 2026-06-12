import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Motion } from '../../theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type HapticKind = boolean | 'light' | 'medium' | 'heavy';

interface Props extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({ scaleTo = 0.96, haptic = false, onPressIn, onPressOut, onPress, style, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={(e) => { scale.value = withSpring(scaleTo, Motion.spring.press); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, Motion.spring.press); onPressOut?.(e); }}
      onPress={(e) => {
        if (haptic) {
          const s = haptic === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
          Haptics.impactAsync(s).catch(() => {});
        }
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children as React.ReactNode}
    </AnimatedPressableBase>
  );
}
