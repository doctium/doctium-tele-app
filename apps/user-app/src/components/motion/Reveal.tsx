import React, { useRef } from "react";
import { View, ViewProps } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { Motion } from "../../theme";
import { useScrollDriver } from "./MotionScrollView";

interface Props extends ViewProps {
  /** Stagger order within a burst of sibling reveals. */
  index?: number;
  /** Rise distance (px). */
  distance?: number;
  /** Add a subtle scale-up on entry. */
  pop?: boolean;
}

/**
 * Viewport-triggered entrance. Inside a MotionScrollView the block stays
 * hidden until it scrolls into view, then springs up once (an
 * IntersectionObserver feel). Outside a driver it simply animates on mount.
 * Respects the OS reduce-motion setting.
 */
export function Reveal({
  index = 0,
  distance = 26,
  pop = false,
  children,
  style,
  onLayout,
  ...rest
}: Props) {
  const driver = useScrollDriver();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const contentY = useSharedValue(-1);
  const fired = useSharedValue(reduced);
  const ref = useRef<View>(null);
  const scrollY = driver?.scrollY ?? null;
  const viewportH = driver?.viewportH ?? null;

  useAnimatedReaction(
    () => {
      if (!scrollY || !viewportH) return true; // no driver → mount entrance
      if (contentY.value < 0 || viewportH.value <= 0) return false;
      // Trigger when ~40px of the block has crossed the fold.
      return scrollY.value + viewportH.value > contentY.value + 40;
    },
    (visible) => {
      if (visible && !fired.value) {
        fired.value = true;
        progress.value = withDelay(
          index * Motion.stagger,
          withSpring(1, Motion.spring.smooth),
        );
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * distance },
      ...(pop ? [{ scale: 0.96 + progress.value * 0.04 }] : []),
    ],
  }));

  return (
    <Animated.View
      {...rest}
      ref={ref}
      style={[style, animatedStyle]}
      onLayout={(e) => {
        // Window position + current scroll offset = position in scroll content.
        ref.current?.measureInWindow((_x, y) => {
          contentY.value = y + (scrollY ? scrollY.value : 0);
        });
        onLayout?.(e);
      }}
    >
      {children}
    </Animated.View>
  );
}
