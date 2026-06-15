import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { AnimatedPressable } from "../ui";
import { Palette, Radius, Space, useThemedStyles } from "../../theme";
import { bannersApi, Banner } from "../../api/banners.api";

// In-app destination keys (set by admins) → expo-router paths.
const APP_ROUTES: Record<string, string> = {
  doctors: "/(app)/(doctors)/search",
  "care-programs": "/(app)/(care)",
  medigram: "/(app)/(clips)",
  wallet: "/(app)/(wallet)",
  subscriptions: "/(app)/(subscription)",
  appointments: "/(app)/(appointments)",
  leenah: "/(app)/(triage)",
  referrals: "/(app)/(profile)/referrals",
};

const AUTOPLAY_MS = 4500;

export function BannerCarousel() {
  const styles = useThemedStyles(makeStyles);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const pageRef = useRef(0);

  useEffect(() => {
    bannersApi
      .getActive()
      .then((b) => setBanners(Array.isArray(b) ? b : []))
      .catch(() => setBanners([]));
  }, []);

  // Auto-advance (only with >1 banner and a known width).
  useEffect(() => {
    if (banners.length <= 1 || width === 0) return;
    const t = setInterval(() => {
      const next = (pageRef.current + 1) % banners.length;
      scroller.current?.scrollTo({ x: next * width, animated: true });
      pageRef.current = next;
      setPage(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [banners.length, width]);

  if (banners.length === 0) return null;

  const onTap = (b: Banner) => {
    bannersApi.recordClick(b.id).catch(() => undefined);
    if (b.type === "EXTERNAL") {
      if (b.target) Linking.openURL(b.target).catch(() => undefined);
      return;
    }
    const route = APP_ROUTES[b.target];
    if (route) router.push(route as never);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    pageRef.current = p;
    setPage(p);
  };

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {width > 0 &&
          banners.map((b) => (
            <AnimatedPressable
              key={b.id}
              haptic="light"
              onPress={() => onTap(b)}
              style={{ width, paddingHorizontal: Space.xl }}
            >
              <Image
                source={{ uri: b.image }}
                style={[styles.image, { width: width - Space.xl * 2 }]}
                resizeMode="cover"
              />
            </AnimatedPressable>
          ))}
      </ScrollView>
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 22 },
    image: {
      aspectRatio: 3, // 3:1 banner
      borderRadius: Radius.xl,
      backgroundColor: c.surface,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginTop: 10,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
    dotActive: { width: 18, backgroundColor: c.teal },
  });
