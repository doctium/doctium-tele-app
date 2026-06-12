import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  Palette,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { SegmentedControl } from "../../../src/components/ui";
import { AppointmentCard } from "../../../src/components/appointment/AppointmentCard";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AppointmentCardSkeleton } from "../../../src/components/common/SkeletonLoader";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchAppointments } from "../../../src/store/slices/appointmentsSlice";

const TABS = ["Upcoming", "Completed", "Cancelled"];
const STATUS_MAP: Record<string, string> = {
  Upcoming: "CONFIRMED",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};

export default function AppointmentsScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { list, loading } = useAppSelector((s) => s.appointments);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchAppointments(STATUS_MAP[activeTab]));
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchAppointments(STATUS_MAP[activeTab]));
    setRefreshing(false);
  }, [dispatch, activeTab]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        style={styles.header}
      >
        <Text style={styles.title}>{t("appointments.title")}</Text>
        <Text style={styles.subtitle}>{t("appointments.subtitle")}</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(90).springify().damping(18)}
        style={styles.tabs}
      >
        <SegmentedControl
          options={TABS.map((tab) => ({
            key: tab,
            label: t(`appointments.tab${tab}`),
          }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </Animated.View>

      {loading ? (
        <View style={styles.list}>
          {Array.from({ length: 4 }, (_, i) => (
            <AppointmentCardSkeleton key={i} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <Animated.View
          key={activeTab}
          entering={FadeInUp.springify().damping(16)}
          style={{ flex: 1 }}
        >
          <EmptyState
            icon="calendar-outline"
            title={t(`appointments.empty${activeTab}`)}
            description={t("appointments.emptyDesc")}
            actionLabel={t("appointments.findDoctor")}
            onAction={() => router.push("/(app)/(doctors)/search")}
          />
        </Animated.View>
      ) : (
        <FlatList
          key={activeTab}
          data={list}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(index < 8 ? index * 55 : 0)
                .springify()
                .damping(18)}
            >
              <AppointmentCard
                appointment={item}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(appointments)/[id]",
                    params: { id: item.id },
                  })
                }
              />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: Space.xl, marginBottom: 18 },
    title: { ...Type.display, color: c.text.primary },
    subtitle: { ...Type.body, color: c.text.secondary, marginTop: 4 },
    tabs: {
      paddingHorizontal: Space.xl,
      marginBottom: 12,
    },
    list: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 120 },
  });
