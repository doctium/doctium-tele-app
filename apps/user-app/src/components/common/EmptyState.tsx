import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt } from "../ui/Txt";
import { Button } from "./Button";
import { Palette, useColors, useThemedStyles } from "../../theme";

interface Props {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = "medical-outline",
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={40} color={colors.teal} />
      </View>
      <Txt variant="h2" center style={{ marginBottom: 6 }}>
        {title}
      </Txt>
      {description ? (
        <Txt
          variant="body"
          center
          color={colors.text.secondary}
          style={{ maxWidth: 290 }}
        >
          {description}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={{ marginTop: 24 }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.tealSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
  });
