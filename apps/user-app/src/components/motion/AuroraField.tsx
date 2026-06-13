import React, { useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export interface AuroraBlobSpec {
  size: number;
  color: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  /** Full back-and-forth drift period (ms). Vary per blob for organic motion. */
  duration?: number;
  driftX?: number;
  driftY?: number;
  /** Parallax: blob shifts against scroll at this rate (0 = pinned). */
  parallax?: number;
}

interface Props {
  blobs: AuroraBlobSpec[];
  /** Optional scroll position for per-blob parallax depth. */
  scrollY?: SharedValue<number>;
  style?: ViewStyle;
}

/**
 * Ambient living background — soft gradient blobs that drift slowly on
 * independent clocks (and at independent parallax depths when scrolling),
 * giving hero surfaces a calm, breathing quality. Pointer-transparent.
 * Static under OS reduce-motion.
 */
export function AuroraField({ blobs, scrollY, style }: Props) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      {blobs.map((b, i) => (
        <AuroraBlob key={i} spec={b} scrollY={scrollY} />
      ))}
    </Animated.View>
  );
}

function AuroraBlob({
  spec,
  scrollY,
}: {
  spec: AuroraBlobSpec;
  scrollY?: SharedValue<number>;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const {
    size,
    color,
    duration = 9000,
    driftX = 26,
    driftY = 18,
    parallax = 0,
    ...position
  } = spec;

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(t.value, [0, 1], [-driftX / 2, driftX / 2]),
      },
      {
        translateY:
          interpolate(t.value, [0, 1], [-driftY / 2, driftY / 2]) +
          (scrollY ? scrollY.value * parallax : 0),
      },
      { scale: interpolate(t.value, [0, 0.5, 1], [1, 1.1, 1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...position,
        },
        animatedStyle,
      ]}
    />
  );
}
