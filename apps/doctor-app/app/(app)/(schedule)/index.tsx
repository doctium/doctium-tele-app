import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { Txt } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface DaySchedule {
  day: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  timeSlot: number;
  isBreak: boolean;
}
const defaultDay = (day: string): DaySchedule => ({
  day,
  startTime: "08:00",
  endTime: "17:00",
  breakStartTime: "12:00",
  breakEndTime: "13:00",
  timeSlot: 30,
  isBreak: true,
});

function TimePill({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<DaySchedule[]>(DAYS.map(defaultDay));
  const [activeDays, setActiveDays] = useState<Set<string>>(
    new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const toggleDay = (day: string) =>
    setActiveDays((prev) => {
      const n = new Set(prev);
      n.has(day) ? n.delete(day) : n.add(day);
      return n;
    });
  const updateDay = (
    day: string,
    field: keyof DaySchedule,
    value: string | boolean | number,
  ) =>
    setSchedule((s) =>
      s.map((d) => (d.day === day ? { ...d, [field]: value } : d)),
    );

  const save = async () => {
    setLoading(true);
    try {
      await doctorApi.upsertSchedule(
        schedule.filter((d) => activeDays.has(d.day)),
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>Set your weekly availability</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {success ? (
          <Animated.View entering={FadeIn} style={styles.success}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.tealDeep}
            />
            <Txt variant="label" color={colors.tealDeep}>
              Schedule saved
            </Txt>
          </Animated.View>
        ) : null}

        {DAYS.map((day) => {
          const d = schedule.find((x) => x.day === day)!;
          const active = activeDays.has(day);
          return (
            <View
              key={day}
              style={[styles.dayCard, !active && styles.dayInactive]}
            >
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{day}</Text>
                <Switch
                  value={active}
                  onValueChange={() => toggleDay(day)}
                  trackColor={{ true: colors.teal, false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
              {active ? (
                <View style={styles.dayBody}>
                  <View style={styles.timeRow}>
                    <TimePill label="Start" value={d.startTime} />
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.text.tertiary}
                    />
                    <TimePill label="End" value={d.endTime} />
                    <TimePill label="Slot" value={`${d.timeSlot}m`} />
                  </View>
                  <View style={styles.breakRow}>
                    <View style={styles.breakLeft}>
                      <Ionicons
                        name="cafe-outline"
                        size={16}
                        color={colors.text.secondary}
                      />
                      <Text style={styles.breakLabel}>Break time</Text>
                    </View>
                    <Switch
                      value={d.isBreak}
                      onValueChange={(v) => updateDay(day, "isBreak", v)}
                      trackColor={{ true: colors.teal, false: colors.border }}
                      thumbColor="#fff"
                    />
                  </View>
                  {d.isBreak ? (
                    <View style={styles.timeRow}>
                      <TimePill label="Break start" value={d.breakStartTime} />
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={colors.text.tertiary}
                      />
                      <TimePill label="Break end" value={d.breakEndTime} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        <Button
          label="Save schedule"
          onPress={save}
          loading={loading}
          size="lg"
          style={{ marginTop: 6 }}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: Space.xl, marginBottom: 16 },
    title: { ...Type.display, color: c.text.primary },
    subtitle: { ...Type.body, color: c.text.secondary, marginTop: 4 },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 130 },
    success: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.tealSoft,
      borderRadius: Radius.md,
      paddingVertical: 12,
      marginBottom: 14,
    },
    dayCard: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    dayInactive: { opacity: 0.6 },
    dayHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dayName: { ...Type.h3, color: c.text.primary },
    dayBody: { marginTop: 14, gap: 12 },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    pill: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    pillLabel: { ...Type.caption, color: c.text.tertiary, fontSize: 10 },
    pillValue: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: c.text.primary,
      marginTop: 2,
    },
    breakRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    breakLabel: { ...Type.bodyMed, color: c.text.secondary },
  });
