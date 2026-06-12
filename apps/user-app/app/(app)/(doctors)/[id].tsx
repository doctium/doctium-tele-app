import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, {
  Extrapolation,
  FadeInDown,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  Gradients,
  Fonts,
  Motion,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useTheme,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { StarRating } from "../../../src/components/common/StarRating";
import { Button } from "../../../src/components/common/Button";
import { AnimatedPressable, Card } from "../../../src/components/ui";
import {
  AuroraField,
  CountUp,
  MotionScrollView,
} from "../../../src/components/motion";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchDoctor } from "../../../src/store/slices/doctorsSlice";
import { toggleFavorite } from "../../../src/store/slices/favoritesSlice";
import { formatMoney } from "../../../src/utils/money";
import { languageNative } from "../../../src/i18n/languages";

const TABS = ["About", "Reviews", "Education", "Experience"];
const TAB_UNDERLINE_W = 28;

export default function DoctorProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id, referralId } = useLocalSearchParams<{
    id: string;
    referralId?: string;
  }>();
  const dispatch = useAppDispatch();
  const { selected: doctor } = useAppSelector((s) => s.doctors);
  const isFav = useAppSelector((s) => s.favorites.ids.includes(id));
  const [tab, setTab] = useState("About");
  const [tabRowW, setTabRowW] = useState(0);

  // ─── Scroll choreography ───
  const scrollY = useSharedValue(0);
  const tabIdx = useSharedValue(0);
  const [scrolled, setScrolled] = useState(false);

  useAnimatedReaction(
    () => scrollY.value > 200,
    (now, prev) => {
      if (now !== prev) runOnJS(setScrolled)(now);
    },
  );

  // Hero stretches elastically on pull-down, anchored to the top edge.
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-240, 0],
          [-120, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [-240, 0],
          [1.24, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Banner photo sits one depth layer behind: drifts down slower than the scroll.
  const bannerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 320],
          [0, 96],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Identity block drifts and dissolves as the hero collapses.
  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [60, 260],
      [1, 0.25],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 320],
          [0, 64],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Frosted title bar condenses in once the identity has scrolled away.
  const condenseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [180, 250],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const condenseTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [200, 260],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [200, 260],
          [10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const slotW = tabRowW > 0 ? tabRowW / TABS.length : 0;
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tabIdx.value * slotW + (slotW - TAB_UNDERLINE_W) / 2 },
    ],
  }));

  useEffect(() => {
    if (id) dispatch(fetchDoctor(id));
  }, [id]);

  if (!doctor) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  const d = doctor as unknown as {
    id: string;
    name: string;
    image?: string;
    bannerImage?: string;
    designation: string;
    experience: number;
    rating: number;
    reviewCount: number;
    charge: number;
    isOnline?: boolean;
    isVerified?: boolean;
    scheduledFee?: number;
    instantDayFee?: number;
    instantNightFee?: number;
    discountActive?: boolean;
    discountPercent?: number;
    discountLabel?: string;
    discountEndsAt?: string | null;
    yourSelf?: string;
    education?: string;
    degree?: string[];
    language?: string[];
    awards?: string[];
    expertise?: string[];
    experienceDetails?: string[];
    reviews?: {
      id: string;
      review: string;
      rating: number;
      user: { name: string; image?: string };
    }[];
  };

  // Doctor promotion — applies to the displayed fees; the booking server recomputes the same way.
  const discountPct =
    d.discountActive &&
    d.discountPercent &&
    d.discountPercent > 0 &&
    (!d.discountEndsAt || new Date(d.discountEndsAt).getTime() > Date.now())
      ? Math.min(d.discountPercent, 100)
      : 0;
  const applyDisc = (n: number) =>
    discountPct > 0 ? Math.round(n * (1 - discountPct / 100)) : n;

  const scheduledOrig =
    d.scheduledFee && d.scheduledFee > 0 ? d.scheduledFee : d.charge;
  const scheduledFee = applyDisc(scheduledOrig);
  const isNight = (() => {
    const h = new Date().getHours();
    return h >= 20 || h < 6;
  })();
  // Instant fee — no base-charge fallback. If the doctor set no instant fee, instant isn't offered.
  const instantOrig =
    (isNight
      ? d.instantNightFee || d.instantDayFee
      : d.instantDayFee || d.instantNightFee) || 0;
  const instantFee = applyDisc(instantOrig);
  const instantAvailable = !!d.isOnline && instantFee > 0;

  const talkNow = () =>
    router.push({
      pathname: "/(app)/(appointments)/confirm",
      params: {
        doctorId: d.id,
        type: "ONLINE",
        mode: "INSTANT",
        date: new Date().toISOString().slice(0, 10),
        time: "now",
        problem: "",
      },
    });
  const bookScheduled = () =>
    router.push({
      pathname: "/(app)/(appointments)/book",
      params: { doctorId: d.id, ...(referralId ? { referralId } : {}) },
    });

  const selectTab = (tb: string, i: number) => {
    setTab(tb);
    tabIdx.value = withSpring(i, Motion.spring.fluid);
  };

  return (
    <View style={styles.root}>
      <StatusBar style={scrolled && !isDark ? "dark" : "light"} />
      <MotionScrollView
        scrollY={scrollY}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* Hero */}
        <Animated.View style={heroStyle}>
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {d.bannerImage ? (
              <>
                <Animated.View style={[StyleSheet.absoluteFill, bannerStyle]}>
                  <Image
                    source={{ uri: d.bannerImage }}
                    style={[StyleSheet.absoluteFill, { top: -96 }]}
                    resizeMode="cover"
                  />
                </Animated.View>
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: "rgba(11,27,48,0.55)" },
                  ]}
                />
              </>
            ) : (
              <AuroraField
                scrollY={scrollY}
                blobs={[
                  {
                    size: 170,
                    color: "rgba(139,187,233,0.16)",
                    top: -40,
                    right: -30,
                    duration: 9500,
                    driftX: 28,
                    driftY: 20,
                    parallax: 0.2,
                  },
                  {
                    size: 190,
                    color: "rgba(139,187,233,0.14)",
                    bottom: -60,
                    left: -40,
                    duration: 13000,
                    driftX: 36,
                    driftY: 24,
                    parallax: 0.32,
                  },
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.heroBody,
                { paddingTop: insets.top + 64 },
                heroContentStyle,
              ]}
            >
              <Animated.View entering={FadeInDown.springify().damping(16)}>
                <Avatar
                  uri={d.image}
                  name={d.name}
                  size={96}
                  ring={d.isOnline}
                />
              </Animated.View>
              <Text style={styles.name}>{d.name}</Text>
              {d.isVerified ? (
                <View style={styles.verifiedPill}>
                  <Ionicons name="shield-checkmark" size={13} color="#fff" />
                  <Text style={styles.verifiedText}>
                    {t("doctors.verified")}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.spec}>{d.designation}</Text>
              {d.isOnline ? (
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>
                    {t("doctors.availableNow")}
                  </Text>
                </View>
              ) : null}

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <CountUp
                    value={d.reviewCount}
                    duration={900}
                    delay={150}
                    style={styles.statVal}
                  />
                  <Text style={styles.statLbl}>
                    {t("doctors.statPatients")}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <CountUp
                    value={d.experience}
                    suffix=" yr"
                    duration={900}
                    delay={260}
                    style={styles.statVal}
                  />
                  <Text style={styles.statLbl}>
                    {t("doctors.statExperience")}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Ionicons name="star" size={14} color="#FBBF24" />
                    <CountUp
                      value={d.rating ?? 0}
                      decimals={1}
                      duration={900}
                      delay={370}
                      style={styles.statVal}
                    />
                  </View>
                  <Text style={styles.statLbl}>{t("doctors.statRating")}</Text>
                </View>
              </View>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Segmented tabs with fluid indicator */}
        <View style={styles.tabBar}>
          <View
            style={styles.tabRow}
            onLayout={(e) => setTabRowW(e.nativeEvent.layout.width)}
          >
            {TABS.map((tb, i) => {
              const active = tab === tb;
              return (
                <AnimatedPressable
                  key={tb}
                  haptic="light"
                  onPress={() => selectTab(tb, i)}
                  style={styles.tabItem}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {t(`doctors.tab${tb}`)}
                  </Text>
                </AnimatedPressable>
              );
            })}
            {slotW > 0 ? (
              <Animated.View style={[styles.tabUnderline, tabIndicatorStyle]} />
            ) : null}
          </View>
        </View>

        {/* Content */}
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={styles.content}
          key={tab}
        >
          {tab === "About" && (
            <>
              <Text style={styles.sectionTitle}>{t("doctors.tabAbout")}</Text>
              <Text style={styles.body}>
                {d.yourSelf || t("doctors.noBio")}
              </Text>
              {d.expertise?.length ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {t("doctors.expertise")}
                  </Text>
                  <View style={styles.chips}>
                    {d.expertise.map((e, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{e}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
              {d.language?.length ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {t("doctors.languages")}
                  </Text>
                  <Text style={styles.body}>
                    {d.language.map(languageNative).join(", ")}
                  </Text>
                </>
              ) : null}
            </>
          )}
          {tab === "Education" && (
            <>
              <Text style={styles.sectionTitle}>{t("doctors.education")}</Text>
              <Text style={styles.body}>
                {d.education || t("doctors.notSpecified")}
              </Text>
              {d.degree?.map((deg, i) => (
                <Bullet key={i} text={deg} />
              ))}
              {d.awards?.length ? (
                <>
                  <Text style={styles.sectionTitle}>{t("doctors.awards")}</Text>
                  {d.awards.map((a, i) => (
                    <Bullet key={i} text={a} icon="trophy" />
                  ))}
                </>
              ) : null}
            </>
          )}
          {tab === "Experience" && (
            <>
              <Text style={styles.sectionTitle}>
                {t("doctors.workExperience")}
              </Text>
              {d.experienceDetails?.length ? (
                d.experienceDetails.map((e, i) => <Bullet key={i} text={e} />)
              ) : (
                <Text style={styles.body}>
                  {t("doctors.yearsPractice", { count: d.experience })}
                </Text>
              )}
            </>
          )}
          {tab === "Reviews" && (
            <>
              <Text style={styles.sectionTitle}>
                {t("doctors.patientReviews")}
              </Text>
              {d.reviews?.length ? (
                d.reviews.map((r, i) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInDown.delay(Math.min(i, 5) * Motion.stagger)
                      .springify()
                      .damping(18)}
                  >
                    <Card
                      padding={16}
                      radius={Radius.lg}
                      style={{ marginBottom: 12 }}
                    >
                      <View style={styles.reviewTop}>
                        <Avatar
                          name={r.user.name}
                          uri={r.user.image}
                          size={40}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewName}>{r.user.name}</Text>
                          <StarRating rating={r.rating} size={12} />
                        </View>
                      </View>
                      <Text style={styles.reviewText}>{r.review}</Text>
                    </Card>
                  </Animated.View>
                ))
              ) : (
                <Text style={styles.body}>{t("doctors.noReviews")}</Text>
              )}
            </>
          )}
        </Animated.View>
      </MotionScrollView>

      {/* ─── Fixed header: glass controls + condensing frosted title bar ─── */}
      <View
        style={[styles.headerOverlay, { height: insets.top + 58 }]}
        pointerEvents="box-none"
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, condenseStyle]}
        >
          <BlurView
            intensity={55}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerHairline} />
        </Animated.View>
        <View
          style={[styles.headerRow, { marginTop: insets.top + 6 }]}
          pointerEvents="box-none"
        >
          <AnimatedPressable
            haptic="light"
            onPress={() => router.back()}
            style={styles.glassBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </AnimatedPressable>
          <Animated.Text
            style={[styles.headerTitle, condenseTitleStyle]}
            numberOfLines={1}
          >
            {d.name}
          </Animated.Text>
          <AnimatedPressable
            haptic="medium"
            onPress={() => dispatch(toggleFavorite(id))}
            style={styles.glassBtn}
          >
            <Ionicons
              name={isFav ? "heart" : "heart-outline"}
              size={20}
              color={isFav ? colors.error : "#fff"}
            />
          </AnimatedPressable>
        </View>
      </View>

      {/* Sticky book bar */}
      <Animated.View
        entering={FadeInUp.delay(180).springify().damping(18)}
        style={[
          styles.bottomWrap,
          { paddingBottom: insets.bottom ? insets.bottom : 16 },
        ]}
      >
        {discountPct > 0 ? (
          <View style={styles.promoStrip}>
            <Ionicons name="pricetag" size={13} color={colors.warning} />
            <Text style={styles.promoStripText}>
              {d.discountLabel || t("doctors.limitedOffer")} · {discountPct}%
              OFF
            </Text>
            <Text style={styles.promoStripWas}>
              {t("doctors.was", { price: formatMoney(scheduledOrig) })}
            </Text>
          </View>
        ) : null}
        <View style={styles.bottomRow}>
          {instantAvailable ? (
            <View style={styles.dualBtns}>
              <Button
                label={t("doctors.talkNow", {
                  price: formatMoney(instantFee),
                })}
                onPress={talkNow}
                variant="secondary"
                style={{ flex: 1 }}
                icon={<Ionicons name="flash" size={16} color="#fff" />}
              />
              <Button
                label={t("doctors.book", {
                  price: formatMoney(scheduledFee),
                })}
                onPress={bookScheduled}
                style={{ flex: 1 }}
                icon={<Ionicons name="calendar" size={16} color="#fff" />}
              />
            </View>
          ) : (
            <>
              <View>
                <Text style={styles.feeLabel}>{t("doctors.consultation")}</Text>
                <Text style={styles.fee}>{formatMoney(scheduledFee)}</Text>
              </View>
              <Button
                label={t("doctors.bookAppointment")}
                onPress={bookScheduled}
                fullWidth={false}
                style={{ flex: 1, marginLeft: 16 }}
                icon={<Ionicons name="calendar" size={17} color="#fff" />}
              />
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function Bullet({
  text,
  icon,
}: {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Ionicons
        name={icon ?? "checkmark-circle"}
        size={16}
        color={colors.teal}
        style={{ marginTop: 2 }}
      />
      <Text style={[styles.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    hero: {
      paddingBottom: 26,
      borderBottomLeftRadius: Radius.xxl,
      borderBottomRightRadius: Radius.xxl,
      overflow: "hidden",
    },

    // Fixed header overlay
    headerOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      overflow: "hidden",
    },
    headerHairline: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.hairline,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Space.xl,
    },
    headerTitle: {
      ...Type.h3,
      color: c.text.primary,
      flex: 1,
      textAlign: "center",
      marginHorizontal: 10,
    },
    glassBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15,27,45,0.30)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.24)",
    },

    heroBody: {
      alignItems: "center",
      paddingHorizontal: Space.xl,
    },
    name: { ...Type.h1, color: "#fff", marginTop: 14, textAlign: "center" },
    verifiedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 8,
      backgroundColor: "rgba(139,187,233,0.30)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.3)",
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    verifiedText: { ...Type.caption, fontFamily: Fonts.bold, color: "#fff" },
    spec: { ...Type.body, color: c.text.onDark, marginTop: 4 },
    onlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(139,187,233,0.22)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.round,
      marginTop: 12,
    },
    onlineDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.tealBright,
    },
    onlineText: { ...Type.caption, fontFamily: Fonts.semibold, color: "#fff" },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 22,
      backgroundColor: "rgba(255,255,255,0.10)",
      borderRadius: Radius.lg,
      paddingVertical: 14,
      alignSelf: "stretch",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.16)",
    },
    stat: { flex: 1, alignItems: "center" },
    statVal: {
      fontFamily: Fonts.extrabold,
      fontSize: 18,
      color: "#fff",
      letterSpacing: -0.4,
      textAlign: "center",
    },
    statLbl: { ...Type.caption, color: c.text.onDarkDim, marginTop: 3 },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 30,
      backgroundColor: "rgba(255,255,255,0.22)",
    },

    tabBar: {
      paddingHorizontal: Space.xl,
      marginTop: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    tabRow: { flexDirection: "row" },
    tabItem: { flex: 1, paddingVertical: 16, alignItems: "center" },
    tabText: { ...Type.label, color: c.text.tertiary },
    tabTextActive: { color: c.navy },
    tabUnderline: {
      position: "absolute",
      bottom: 0,
      left: 0,
      height: 3,
      width: TAB_UNDERLINE_W,
      borderRadius: 2,
      backgroundColor: c.teal,
    },

    content: { paddingHorizontal: Space.xl, paddingTop: 6 },
    sectionTitle: {
      ...Type.h3,
      color: c.text.primary,
      marginTop: 18,
      marginBottom: 8,
    },
    body: { ...Type.body, color: c.text.secondary },
    bulletRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      backgroundColor: c.tealSoft,
      borderRadius: Radius.round,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      color: c.tealDeep,
    },
    reviewTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
    },
    reviewName: { ...Type.title, color: c.text.primary, marginBottom: 2 },
    reviewText: { ...Type.bodySm, color: c.text.secondary },

    bottomWrap: {
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
    bottomRow: { flexDirection: "row", alignItems: "center" },
    promoStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: 12,
      backgroundColor: c.warningSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.md,
    },
    promoStripText: {
      ...Type.caption,
      fontFamily: Fonts.bold,
      color: c.warning,
      flex: 1,
    },
    promoStripWas: {
      ...Type.caption,
      color: c.text.tertiary,
      textDecorationLine: "line-through",
    },
    feeLabel: { ...Type.caption, color: c.text.tertiary },
    fee: {
      fontFamily: Fonts.extrabold,
      fontSize: 22,
      color: c.navy,
      letterSpacing: -0.5,
    },
    dualBtns: { flex: 1, flexDirection: "row", gap: 10 },
  });
