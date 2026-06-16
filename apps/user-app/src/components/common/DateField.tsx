import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  useColors,
  useThemedStyles,
} from "../../theme";

interface Props {
  label?: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  leftIcon?: React.ReactNode;
  maximumDate?: Date;
}

// Parse/format without timezone drift (treat the date as calendar-local).
function ymdToDate(s?: string): Date | undefined {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
function dateToYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function niceDate(s: string): string {
  const d = ymdToDate(s);
  return d
    ? d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : s;
}

/** Tap-to-pick date field (native picker; no keyboard). Stores "YYYY-MM-DD". */
export function DateField({
  label,
  value,
  onChange,
  placeholder,
  leftIcon,
  maximumDate,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);

  const max = maximumDate ?? new Date();
  // Default the picker to a sensible adult birth year when empty.
  const initial =
    ymdToDate(value) ?? new Date(new Date().getFullYear() - 25, 0, 1);

  const onNative = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (e.type === "set" && d) onChange(dateToYmd(d));
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.row} onPress={() => setShow(true)}>
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
        <Text style={[styles.value, !value && { color: colors.text.tertiary }]}>
          {value ? niceDate(value) : (placeholder ?? "Select date")}
        </Text>
      </Pressable>

      {show && Platform.OS === "android" ? (
        <DateTimePicker
          value={initial}
          mode="date"
          maximumDate={max}
          onChange={onNative}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setShow(false)}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={initial}
                mode="date"
                display="spinner"
                maximumDate={max}
                onChange={(_e, d) => d && onChange(dateToYmd(d))}
                textColor={colors.text.primary}
              />
              <Pressable style={styles.doneBtn} onPress={() => setShow(false)}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { marginBottom: Space.lg },
    label: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: c.text.secondary,
      marginBottom: 8,
      marginLeft: 2,
      letterSpacing: -0.1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      minHeight: 56,
    },
    value: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.medium,
      color: c.text.primary,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    iconLeft: { paddingLeft: 14 },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(11,27,48,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Space.xl,
      paddingTop: Space.md,
      paddingBottom: Space.xxxl,
    },
    doneBtn: {
      alignSelf: "stretch",
      backgroundColor: c.teal,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: Space.sm,
    },
    doneText: { color: "#fff", fontSize: 16, fontFamily: Fonts.bold },
  });
