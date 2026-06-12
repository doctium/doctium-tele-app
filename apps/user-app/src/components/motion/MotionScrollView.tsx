import React, { createContext, useContext, useMemo } from "react";
import { LayoutChangeEvent, ScrollViewProps } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

/**
 * Scroll driver — a shared scroll position + viewport height that any
 * descendant can read on the UI thread. This is the backbone of the app's
 * scroll-based motion: parallax heroes, frosted headers that condense,
 * and `Reveal` blocks that enter as they cross into view.
 */
export interface ScrollDriver {
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
}

const ScrollDriverContext = createContext<ScrollDriver | null>(null);

export function useScrollDriver(): ScrollDriver | null {
  return useContext(ScrollDriverContext);
}

interface Props extends ScrollViewProps {
  /** Own the scroll position from the screen (for hero parallax etc.). */
  scrollY?: SharedValue<number>;
  children?: React.ReactNode;
}

export function MotionScrollView({
  scrollY: external,
  children,
  onLayout,
  ...rest
}: Props) {
  const internal = useSharedValue(0);
  const scrollY = external ?? internal;
  const viewportH = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const driver = useMemo<ScrollDriver>(
    () => ({ scrollY, viewportH }),
    [scrollY, viewportH],
  );

  return (
    <ScrollDriverContext.Provider value={driver}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        {...rest}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e: LayoutChangeEvent) => {
          viewportH.value = e.nativeEvent.layout.height;
          onLayout?.(e);
        }}
      >
        {children}
      </Animated.ScrollView>
    </ScrollDriverContext.Provider>
  );
}
