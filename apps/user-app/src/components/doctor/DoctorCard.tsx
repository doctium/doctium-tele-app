import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AnimatedPressable } from "../ui/AnimatedPressable";
import { Avatar } from "../common/Avatar";
import { StarRating } from "../common/StarRating";
import {
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  Palette,
  useColors,
  useThemedStyles,
} from "../../theme";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { toggleFavorite } from "../../store/slices/favoritesSlice";
import { formatMoney } from "../../utils/money";
import { languageNative } from "../../i18n/languages";

interface Doctor {
  id: string;
  name: string;
  image?: string;
  designation: string;
  experience: number;
  rating: number;
  reviewCount: number;
  charge: number;
  isOnline?: boolean;
  expertise?: string[];
  language?: string[];
  isFeatured?: boolean;
  isVerified?: boolean;
  discountActive?: boolean;
  discountPercent?: number;
}

interface Props {
  doctor: Doctor;
  onPress: () => void;
  horizontal?: boolean;
}

export function DoctorCard({ doctor, onPress, horizontal }: Props) {
  const dispatch = useAppDispatch();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const isFav = useAppSelector((s) => s.favorites.ids.includes(doctor.id));
  const onSale = !!doctor.discountActive && (doctor.discountPercent ?? 0) > 0;
  const offPct = Math.min(doctor.discountPercent ?? 0, 100);
  // Diaspora value: highlight when a doctor speaks the patient's chosen language.
  // Skipped for English (the baseline) so the badge stays meaningful.
  const speaksMine =
    i18n.language !== "en" && !!doctor.language?.includes(i18n.language);
  const langs = doctor.language ?? [];

  const Heart = ({ style }: { style?: object }) => (
    <AnimatedPressable
      haptic="medium"
      onPress={() => dispatch(toggleFavorite(doctor.id))}
      style={[styles.heart, style]}
    >
      <Ionicons
        name={isFav ? "heart" : "heart-outline"}
        size={20}
        color={isFav ? colors.error : colors.text.tertiary}
      />
    </AnimatedPressable>
  );
  if (horizontal) {
    return (
      <AnimatedPressable onPress={onPress} haptic="light" style={styles.hCard}>
        <Heart style={styles.heartAbs} />
        <View style={styles.hAvatar}>
          <Avatar
            uri={doctor.image}
            name={doctor.name}
            size={62}
            ring={doctor.isOnline}
          />
          {doctor.isOnline && <View style={styles.onlineDotH} />}
        </View>
        <Text style={styles.hName} numberOfLines={1}>
          {doctor.name}
        </Text>
        <Text style={styles.hSpec} numberOfLines={1}>
          {doctor.designation}
        </Text>
        <View style={{ marginVertical: 8 }}>
          <StarRating rating={doctor.rating} size={12} />
        </View>
        <View style={styles.hFeePill}>
          <Text style={styles.hFee}>{formatMoney(doctor.charge)}</Text>
        </View>
        {onSale ? (
          <View style={[styles.offPill, { marginTop: 6 }]}>
            <Text style={styles.offPillText}>{offPct}% OFF</Text>
          </View>
        ) : null}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable onPress={onPress} haptic="light" style={styles.card}>
      <View style={styles.avatarWrap}>
        <Avatar uri={doctor.image} name={doctor.name} size={60} />
        {doctor.isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {doctor.name}
          </Text>
          {doctor.isVerified ? (
            <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
          ) : null}
        </View>
        <Text style={styles.spec} numberOfLines={1}>
          {doctor.designation}
          {doctor.experience ? ` · ${doctor.experience} yrs` : ""}
        </Text>
        <View style={styles.metaRow}>
          <StarRating
            rating={doctor.rating}
            size={13}
            showCount
            count={doctor.reviewCount}
          />
          {doctor.isFeatured && (
            <View style={styles.featPill}>
              <Text style={styles.featPillText}>★ {t("doctors.featured")}</Text>
            </View>
          )}
          {doctor.isOnline && (
            <View style={styles.onlinePill}>
              <View style={styles.onlinePillDot} />
              <Text style={styles.onlinePillText}>
                {t("doctors.available")}
              </Text>
            </View>
          )}
          {speaksMine && (
            <View style={styles.speaksPill}>
              <Ionicons name="language" size={11} color={colors.tealDeep} />
              <Text style={styles.speaksPillText}>
                {t("doctors.speaksYourLanguage")}
              </Text>
            </View>
          )}
        </View>
        {langs.length > 0 && (
          <View style={styles.langRow}>
            <Ionicons
              name="chatbubbles-outline"
              size={12}
              color={colors.text.tertiary}
            />
            <Text style={styles.langText} numberOfLines={1}>
              {langs.map(languageNative).join(" · ")}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.feeCol}>
        <Heart style={styles.heartFee} />
        {onSale ? (
          <View style={styles.offPill}>
            <Text style={styles.offPillText}>{offPct}% OFF</Text>
          </View>
        ) : null}
        <Text style={styles.fee}>{formatMoney(doctor.charge)}</Text>
        <Text style={styles.feeLabel}>per visit</Text>
      </View>
    </AnimatedPressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.md,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    heart: { padding: 4 },
    heartFee: { marginBottom: 2 },
    heartAbs: { position: "absolute", top: 8, right: 8, zIndex: 2 },
    avatarWrap: { position: "relative" },
    onlineDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: c.teal,
      borderWidth: 3,
      borderColor: c.surface,
    },
    info: { flex: 1 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    name: { ...Type.h3, color: c.text.primary, flexShrink: 1 },
    spec: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      columnGap: 8,
      rowGap: 6,
      marginTop: 7,
    },
    onlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.tealSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.round,
    },
    onlinePillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.teal,
    },
    onlinePillText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
      fontSize: 11,
    },
    speaksPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.tealSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.round,
    },
    speaksPillText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
      fontSize: 11,
    },
    langRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
    },
    langText: {
      ...Type.caption,
      color: c.text.tertiary,
      fontSize: 11,
      flexShrink: 1,
    },
    feeCol: { alignItems: "flex-end" },
    fee: {
      fontFamily: Fonts.extrabold,
      fontSize: 17,
      color: c.navy,
      letterSpacing: -0.3,
    },
    feeLabel: {
      ...Type.caption,
      color: c.text.tertiary,
      fontSize: 11,
      marginTop: 1,
    },
    offPill: {
      backgroundColor: c.warning,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: Radius.sm,
      marginBottom: 3,
    },
    offPillText: {
      fontFamily: Fonts.bold,
      fontSize: 10,
      color: "#fff",
      letterSpacing: 0.2,
    },
    featPill: {
      backgroundColor: c.navySoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.round,
    },
    featPillText: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      color: c.navy,
    },

    // Horizontal (carousel) card
    hCard: {
      width: 156,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 16,
      marginRight: 14,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    hAvatar: { position: "relative", marginBottom: 10 },
    onlineDotH: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: c.teal,
      borderWidth: 3,
      borderColor: c.surface,
    },
    hName: { ...Type.title, color: c.text.primary, textAlign: "center" },
    hSpec: {
      ...Type.caption,
      color: c.text.secondary,
      textAlign: "center",
      marginTop: 2,
    },
    hFeePill: {
      backgroundColor: c.navySoft,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.round,
    },
    hFee: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: c.navy,
      letterSpacing: -0.2,
    },
  });
