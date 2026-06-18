import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Gradients,
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { Avatar } from "../../../src/components/common/Avatar";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import {
  fetchDoctor,
  fetchSlots,
} from "../../../src/store/slices/doctorsSlice";
import { formatMoney } from "../../../src/utils/money";

const TYPES = [
  {
    key: "ONLINE",
    icon: "videocam" as const,
  },
  {
    key: "CLINIC",
    icon: "business" as const,
  },
];

function getDatesAhead(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().split("T")[0],
      weekday: d.toLocaleDateString("en-NG", { weekday: "short" }),
      day: d.getDate().toString(),
      month: d.toLocaleDateString("en-NG", { month: "short" }),
    };
  });
}

export default function BookAppointmentScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { doctorId, referralId } = useLocalSearchParams<{
    doctorId: string;
    referralId?: string;
  }>();
  const dispatch = useAppDispatch();
  const { selected: doctor, slots } = useAppSelector((s) => s.doctors);
  const dates = getDatesAhead(14);
  const [selectedDate, setSelectedDate] = useState(dates[0]!.iso);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [apptType, setApptType] = useState("ONLINE");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (doctorId) dispatch(fetchDoctor(doctorId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);
  useEffect(() => {
    if (doctorId && selectedDate)
      dispatch(fetchSlots({ id: doctorId, date: selectedDate }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, selectedDate]);

  const d = doctor as {
    name?: string;
    charge?: number;
    image?: string;
    designation?: string;
  } | null;

  const goToConfirm = () => {
    if (!selectedSlot) return;
    router.push({
      pathname: "/(app)/(appointments)/confirm",
      params: {
        doctorId,
        date: selectedDate,
        time: selectedSlot,
        type: apptType,
        mode: "SCHEDULED",
        problem,
        subPatientId: "",
        ...(referralId ? { referralId } : {}),
      },
    });
  };

  return (
    <View style={styles.root}>
      <AppHeader title={t("booking.book.title")} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Doctor banner */}
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.docBanner}
        >
          <Avatar uri={d?.image} name={d?.name} size={52} ring />
          <View style={{ flex: 1 }}>
            <Text style={styles.docName} numberOfLines={1}>
              {d?.name ?? t("booking.book.doctorFallback")}
            </Text>
            <Text style={styles.docSpec} numberOfLines={1}>
              {d?.designation ?? t("booking.book.consultationFallback")}
            </Text>
          </View>
          <View style={styles.feeChip}>
            <Text style={styles.feeChipText}>
              {formatMoney(d?.charge ?? 0)}
            </Text>
          </View>
        </LinearGradient>

        <Txt variant="h3" style={styles.label}>
          {t("booking.book.consultationType")}
        </Txt>
        <View style={styles.typeRow}>
          {TYPES.map((item) => {
            const active = apptType === item.key;
            return (
              <AnimatedPressable
                key={item.key}
                haptic="light"
                onPress={() => setApptType(item.key)}
                style={[styles.typeCard, active && styles.typeActive]}
              >
                <View
                  style={[
                    styles.typeIcon,
                    active && { backgroundColor: colors.teal },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={active ? "#fff" : colors.navyMid}
                  />
                </View>
                <Text style={styles.typeLabel}>
                  {t(`booking.book.type${item.key}Label`)}
                </Text>
                <Text style={styles.typeDesc}>
                  {t(`booking.book.type${item.key}Desc`)}
                </Text>
                {active ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.teal}
                    style={styles.typeCheck}
                  />
                ) : null}
              </AnimatedPressable>
            );
          })}
        </View>

        <Txt variant="h3" style={styles.label}>
          {t("booking.book.selectDate")}
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datesRow}
        >
          {dates.map((date) => {
            const active = selectedDate === date.iso;
            return (
              <AnimatedPressable
                key={date.iso}
                haptic="light"
                onPress={() => setSelectedDate(date.iso)}
                style={[styles.dateTile, active && styles.dateActive]}
              >
                <Text style={[styles.dateWeekday, active && styles.dateOn]}>
                  {date.weekday}
                </Text>
                <Text style={[styles.dateDay, active && styles.dateOn]}>
                  {date.day}
                </Text>
                <Text style={[styles.dateMonth, active && styles.dateOn]}>
                  {date.month}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        <Txt variant="h3" style={styles.label}>
          {t("booking.book.availableTimes")}
        </Txt>
        {slots.length === 0 ? (
          <View style={styles.noSlots}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.text.tertiary}
            />
            <Text style={styles.noSlotsText}>{t("booking.book.noSlots")}</Text>
          </View>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((slot) => {
              const active = selectedSlot === slot;
              return (
                <AnimatedPressable
                  key={slot}
                  haptic="light"
                  onPress={() => setSelectedSlot(slot)}
                  style={[styles.slot, active && styles.slotActive]}
                >
                  <Text
                    style={[styles.slotText, active && styles.slotTextActive]}
                  >
                    {slot}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        )}

        <Txt variant="h3" style={styles.label}>
          {t("booking.book.reasonForVisit")}
        </Txt>
        <TextInput
          style={styles.problemInput}
          placeholder={t("booking.book.reasonPlaceholder")}
          placeholderTextColor={colors.text.tertiary}
          value={problem}
          onChangeText={setProblem}
          multiline
        />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom ? insets.bottom : 16 },
        ]}
      >
        <Button
          label={t("booking.book.continue")}
          onPress={goToConfirm}
          disabled={!selectedSlot}
          size="lg"
          icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 110, paddingTop: 4 },
    docBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: Radius.xl,
      padding: 14,
      ...Shadow.raised,
    },
    docName: { ...Type.h3, color: "#fff" },
    docSpec: { ...Type.caption, color: c.text.onDark, marginTop: 2 },
    feeChip: {
      backgroundColor: "rgba(255,255,255,0.16)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.md,
    },
    feeChipText: { fontFamily: Fonts.bold, fontSize: 14, color: "#fff" },
    label: { marginTop: 24, marginBottom: 12 },
    typeRow: { flexDirection: "row", gap: 12 },
    typeCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      padding: 16,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    typeActive: { borderColor: c.teal, backgroundColor: c.tealSoft },
    typeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    typeLabel: { ...Type.title, color: c.text.primary },
    typeDesc: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    typeCheck: { position: "absolute", top: 12, right: 12 },
    datesRow: { gap: 10, paddingBottom: 2 },
    dateTile: {
      width: 62,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      backgroundColor: c.surface,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    dateActive: { backgroundColor: c.navy, borderColor: c.navy },
    dateWeekday: {
      ...Type.caption,
      color: c.text.tertiary,
      textTransform: "uppercase",
    },
    dateDay: {
      fontFamily: Fonts.extrabold,
      fontSize: 20,
      color: c.text.primary,
      marginVertical: 2,
    },
    dateMonth: { ...Type.caption, color: c.text.tertiary },
    dateOn: { color: "#fff" },
    noSlots: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.lg,
      padding: 16,
    },
    noSlotsText: { ...Type.bodySm, color: c.text.tertiary },
    slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    slot: {
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: Radius.md,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    slotActive: { backgroundColor: c.teal, borderColor: c.teal },
    slotText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: c.text.primary,
    },
    slotTextActive: { color: "#fff" },
    problemInput: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 16,
      ...Type.bodyMed,
      color: c.text.primary,
      minHeight: 100,
      textAlignVertical: "top",
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      paddingHorizontal: Space.xl,
      paddingTop: 14,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      ...Shadow.floating,
    },
  });
