import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../ui/AnimatedPressable";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import {
  Fonts,
  Radius,
  Shadow,
  Type,
  Palette,
  useColors,
  useThemedStyles,
} from "../../theme";

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
  doctor?: { name?: string; image?: string; designation?: string };
  service?: { name?: string };
}

interface Props {
  appointment: Appointment;
  onPress: () => void;
}

const statusMap: Record<
  string,
  "pending" | "confirmed" | "completed" | "cancelled"
> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export function AppointmentCard({ appointment, onPress }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const isVideo = appointment.type === "ONLINE";
  return (
    <AnimatedPressable haptic="light" onPress={onPress} style={styles.card}>
      <View style={styles.top}>
        <Avatar
          uri={appointment.doctor?.image}
          name={appointment.doctor?.name}
          size={50}
        />
        <View style={styles.info}>
          <Text style={styles.docName} numberOfLines={1}>
            {appointment.doctor?.name ?? "Doctor"}
          </Text>
          <Text style={styles.spec} numberOfLines={1}>
            {appointment.doctor?.designation ??
              appointment.service?.name ??
              "Consultation"}
          </Text>
        </View>
        <Badge variant={statusMap[appointment.status] ?? "info"} />
      </View>

      <View style={styles.divider} />

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={15} color={colors.teal} />
          <Text style={styles.metaText}>{appointment.date}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={15} color={colors.teal} />
          <Text style={styles.metaText}>{appointment.time}</Text>
        </View>
        <View style={styles.typePill}>
          <Ionicons
            name={isVideo ? "videocam" : "business"}
            size={13}
            color={colors.navyMid}
          />
          <Text style={styles.typeText}>{isVideo ? "Video" : "Clinic"}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    top: { flexDirection: "row", alignItems: "center", gap: 12 },
    info: { flex: 1 },
    docName: { ...Type.title, color: c.text.primary },
    spec: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    meta: { flexDirection: "row", alignItems: "center", gap: 16 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { ...Type.caption, color: c.text.secondary },
    typePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.navySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.round,
      marginLeft: "auto",
    },
    typeText: { fontFamily: Fonts.semibold, fontSize: 11, color: c.navyMid },
  });
