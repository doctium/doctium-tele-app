import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import {
  Radius,
  Shadow,
  Palette,
  useColors,
  useThemedStyles,
} from "../../theme";

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: Props) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 760,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 760,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DoctorCardSkeleton() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.doctorCard}>
      <SkeletonLoader width={60} height={60} borderRadius={30} />
      <View style={styles.info}>
        <SkeletonLoader
          width="55%"
          height={15}
          borderRadius={7}
          style={{ marginBottom: 9 }}
        />
        <SkeletonLoader
          width="80%"
          height={12}
          borderRadius={6}
          style={{ marginBottom: 9 }}
        />
        <SkeletonLoader width="35%" height={12} borderRadius={6} />
      </View>
      <SkeletonLoader width={48} height={18} borderRadius={6} />
    </View>
  );
}

export function AppointmentCardSkeleton() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.apptCard}>
      <SkeletonLoader
        height={15}
        borderRadius={7}
        style={{ marginBottom: 10, width: "50%" }}
      />
      <SkeletonLoader
        width="75%"
        height={12}
        borderRadius={6}
        style={{ marginBottom: 8 }}
      />
      <SkeletonLoader width="40%" height={12} borderRadius={6} />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    doctorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      marginBottom: 14,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    info: { flex: 1 },
    apptCard: {
      padding: 18,
      marginBottom: 14,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
  });
