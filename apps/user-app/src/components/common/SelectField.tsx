import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  useColors,
  useThemedStyles,
} from "../../theme";

export type SelectOption = { label: string; value: string };

interface Props {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  leftIcon?: React.ReactNode;
}

/** Tap-to-select dropdown styled to match Input (no keyboard). */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  leftIcon,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.row} onPress={() => setOpen(true)}>
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
        <Text
          style={[styles.value, !selected && { color: colors.text.tertiary }]}
        >
          {selected ? selected.label : (placeholder ?? "Select")}
        </Text>
        <View style={styles.iconRight}>
          <Ionicons
            name="chevron-down"
            size={18}
            color={colors.text.tertiary}
          />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            {options.map((o) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  style={styles.option}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && { color: colors.teal, fontFamily: Fonts.bold },
                    ]}
                  >
                    {o.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={18} color={colors.teal} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
    iconRight: { paddingHorizontal: 14 },
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
      paddingTop: Space.lg,
      paddingBottom: Space.xxxl,
    },
    sheetTitle: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: c.text.secondary,
      marginBottom: 8,
      marginLeft: 2,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    optionText: {
      fontSize: 16,
      fontFamily: Fonts.medium,
      color: c.text.primary,
    },
  });
