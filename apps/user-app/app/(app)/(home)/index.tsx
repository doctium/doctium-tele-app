import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  Palette,
  Gradients,
  Fonts,
  Radius,
  Shadow,
  Space,
  Type,
  useTheme,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable } from "../../../src/components/ui";
import {
  AuroraField,
  MotionScrollView,
  Reveal,
} from "../../../src/components/motion";
import { DoctorCard } from "../../../src/components/doctor/DoctorCard";
import { DoctorCardSkeleton } from "../../../src/components/common/SkeletonLoader";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchDoctors } from "../../../src/store/slices/doctorsSlice";
import { fetchProfile } from "../../../src/store/slices/userSlice";
import { BannerCarousel } from "../../../src/components/common/BannerCarousel";
import { servicesApi } from "../../../src/api/services.api";
import { satisfactionApi } from "../../../src/api/satisfaction.api";
import { regionsApi } from "../../../src/api/regions.api";
import { ENABLED_LANGUAGES } from "../../../src/i18n/languages";
import { captureLocationOnce } from "../../../src/utils/captureLocation";

interface Service {
  id: string;
  name: string;
  image?: string;
}
interface Region {
  code: string;
  name: string;
}

// Consultation-type options map to the search screen's `type` param.
const TYPE_OPTIONS: { key: string; labelKey: string; fallback: string }[] = [
  { key: "All", labelKey: "doctors.filterAll", fallback: "All" },
  { key: "Online", labelKey: "doctors.filterOnline", fallback: "Online" },
  { key: "Clinic", labelKey: "doctors.filterClinic", fallback: "Clinic" },
  {
    key: "Top rated",
    labelKey: "doctors.filterTopRated",
    fallback: "Top rated",
  },
];

type IoniconName = keyof typeof Ionicons.glyphMap;

// Doctor-carousel geometry (card width + trailing margin) for snap + focus scaling.
const CAROUSEL_STEP = 170;

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "home.morning";
  if (h < 17) return "home.afternoon";
  return "home.evening";
}

function iconForService(name: string): IoniconName {
  const n = name.toLowerCase();
  if (n.includes("cardio") || n.includes("heart")) return "heart";
  if (n.includes("dent") || n.includes("tooth")) return "happy";
  if (n.includes("eye") || n.includes("optic")) return "eye";
  if (n.includes("neuro") || n.includes("brain")) return "pulse";
  if (n.includes("child") || n.includes("pediatr")) return "happy-outline";
  if (n.includes("skin") || n.includes("derma")) return "sparkles";
  if (n.includes("bone") || n.includes("ortho")) return "body";
  if (n.includes("mind") || n.includes("psych") || n.includes("mental"))
    return "happy";
  if (n.includes("lung") || n.includes("pulmo")) return "fitness";
  return "medkit";
}

/** Carousel card that breathes: full size in focus, recedes at the edges. */
function CarouselCard({
  index,
  scrollX,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  children: React.ReactNode;
}) {
  const range = [
    (index - 1) * CAROUSEL_STEP,
    index * CAROUSEL_STEP,
    (index + 1) * CAROUSEL_STEP,
  ];
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          range,
          [0.93, 1, 0.93],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          scrollX.value,
          range,
          [7, 0, 7],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { list: doctors, loading } = useAppSelector((s) => s.doctors);
  const { profile } = useAppSelector((s) => s.user);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [openSurveys, setOpenSurveys] = useState<
    { id: string; doctor?: { name?: string } }[]
  >([]);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  // Search filters (sheet opened from the filter icon)
  const [filterOpen, setFilterOpen] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [fType, setFType] = useState("All");
  const [fLang, setFLang] = useState("");
  const [fCountry, setFCountry] = useState("");
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // ─── Scroll choreography ───
  const scrollY = useSharedValue(0);
  const carouselX = useSharedValue(0);
  const [scrolled, setScrolled] = useState(false);

  // Flip the status bar + compact header once the hero has scrolled away.
  useAnimatedReaction(
    () => scrollY.value > 78,
    (now, prev) => {
      if (now !== prev) runOnJS(setScrolled)(now);
    },
  );

  // Hero stretches elastically on pull-down (anchored to the top edge).
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-220, 0],
          [-110, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollY.value,
          [-220, 0],
          [1.22, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Greeting drifts down slower than the scroll and dissolves — depth layer 2.
  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 110], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 160],
          [0, 56],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Frosted compact header condenses in as the hero leaves.
  const stickyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [64, 118], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [64, 118],
          [-14, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const onCarouselScroll = useAnimatedScrollHandler((e) => {
    carouselX.value = e.contentOffset.x;
  });

  const load = useCallback(() => {
    dispatch(fetchProfile());
    dispatch(fetchDoctors());
    servicesApi
      .getAll()
      .then((r: unknown) => setServices((r as { data: Service[] }).data ?? []))
      .catch(() => {});
    satisfactionApi
      .getMine()
      .then((r: unknown) =>
        setOpenSurveys(
          (
            r as {
              data: { open: { id: string; doctor?: { name?: string } }[] };
            }
          ).data?.open ?? [],
        ),
      )
      .catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);
  // Capture the patient's country once (for region-aware discovery); silent if denied.
  useEffect(() => {
    captureLocationOnce((profile as { country?: string } | null)?.country);
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 800);
  }, [load]);

  const onSearch = () => {
    if (search.trim())
      router.push({
        pathname: "/(app)/(doctors)/search",
        params: { q: search },
      });
  };

  // Available regions for the filter sheet.
  useEffect(() => {
    regionsApi
      .getAvailable()
      .then((r: unknown) => setRegions((r as { data: Region[] }).data ?? []))
      .catch(() => {});
  }, []);

  const hasActiveFilters = fType !== "All" || !!fLang || !!fCountry;

  const resetFilters = () => {
    setFType("All");
    setFLang("");
    setFCountry("");
  };

  const applyFilters = () => {
    setFilterOpen(false);
    router.push({
      pathname: "/(app)/(doctors)/search",
      params: {
        q: search.trim() || undefined,
        type: fType,
        language: fLang || undefined,
        country: fCountry || undefined,
      },
    });
  };

  const firstName = profile?.name?.split(" ")[0] ?? t("home.fallbackName");

  return (
    <View style={styles.root}>
      <StatusBar style={scrolled && !isDark ? "dark" : "light"} />
      <MotionScrollView
        scrollY={scrollY}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
            colors={[colors.teal]}
            progressViewOffset={60}
          />
        }
      >
        {/* ─── Hero ─── */}
        <Animated.View style={heroStyle}>
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 14 }]}
          >
            <AuroraField
              scrollY={scrollY}
              blobs={[
                {
                  size: 180,
                  color: "rgba(139,187,233,0.18)",
                  top: -50,
                  right: -30,
                  duration: 9000,
                  driftX: 30,
                  driftY: 22,
                  parallax: 0.22,
                },
                {
                  size: 200,
                  color: "rgba(139,187,233,0.16)",
                  bottom: -70,
                  left: -40,
                  duration: 12000,
                  driftX: 38,
                  driftY: 26,
                  parallax: 0.34,
                },
                {
                  size: 120,
                  color: "rgba(46,124,194,0.20)",
                  top: 40,
                  left: 90,
                  duration: 15000,
                  driftX: 46,
                  driftY: 30,
                  parallax: 0.12,
                },
              ]}
            />

            <Animated.View style={heroContentStyle}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting}>{t(greetingKey())},</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {firstName} 👋
                  </Text>
                </View>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => router.push("/(app)/(support)")}
                  style={[styles.bell, { marginRight: 10 }]}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={21}
                    color="#fff"
                  />
                </AnimatedPressable>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => router.push("/(app)/(profile)/notifications")}
                  style={styles.bell}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="#fff"
                  />
                  <View style={styles.bellDot} />
                </AnimatedPressable>
              </View>

              <Text style={styles.tagline}>{t("home.tagline")}</Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* ─── Floating search ─── */}
        <Reveal pop style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={19} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("home.searchPlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={onSearch}
              returnKeyType="search"
            />
            <AnimatedPressable
              haptic="light"
              onPress={() => setFilterOpen(true)}
              style={styles.searchBtn}
            >
              <Ionicons name="options-outline" size={18} color="#fff" />
              {hasActiveFilters ? <View style={styles.filterDot} /> : null}
            </AnimatedPressable>
          </View>
        </Reveal>

        {/* ─── Instant consult CTA ─── */}
        <Reveal index={1} pop>
          <AnimatedPressable
            haptic="light"
            onPress={() => router.push("/(app)/(doctors)/search")}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={Gradients.aurora}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <AuroraField
                blobs={[
                  {
                    size: 140,
                    color: "rgba(255,255,255,0.12)",
                    top: -40,
                    right: -20,
                    duration: 8000,
                    driftX: 22,
                    driftY: 16,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>{t("home.ctaTitle")}</Text>
                <Text style={styles.ctaSub}>{t("home.ctaSub")}</Text>
                <View style={styles.ctaBtn}>
                  <Text style={styles.ctaBtnText}>{t("home.ctaBtn")}</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color={colors.navy}
                  />
                </View>
              </View>
              <View style={styles.ctaIcon}>
                <Ionicons name="medical" size={30} color="#fff" />
              </View>
            </LinearGradient>
          </AnimatedPressable>
        </Reveal>

        {/* ─── AI symptom checker entry ─── */}
        <Reveal index={2}>
          <AnimatedPressable
            haptic="light"
            onPress={() => router.push("/(app)/(triage)")}
            style={styles.triageCard}
          >
            <View style={styles.triageIcon}>
              <Ionicons name="sparkles" size={19} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.triageTitle}>{t("home.triageTitle")}</Text>
              <Text style={styles.triageSub}>{t("home.triageSub")}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text.tertiary}
            />
          </AnimatedPressable>
        </Reveal>

        {/* ─── Open satisfaction survey prompt ─── */}
        {openSurveys.length > 0 && !surveyDismissed ? (
          <Reveal index={3}>
            <View style={styles.surveyCard}>
              <View style={styles.surveyIcon}>
                <Ionicons name="happy" size={20} color={colors.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.surveyTitle} numberOfLines={1}>
                  {openSurveys.length === 1
                    ? t("home.surveyOne", {
                        name:
                          openSurveys[0]?.doctor?.name ??
                          t("home.doctorFallback"),
                      })
                    : t("home.surveyMany", { count: openSurveys.length })}
                </Text>
                <Text style={styles.surveySub}>{t("home.surveySub")}</Text>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => router.push("/(app)/(profile)/surveys")}
                  style={styles.surveyBtn}
                >
                  <Text style={styles.surveyBtnText}>{t("home.rateNow")}</Text>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </AnimatedPressable>
              </View>
              <AnimatedPressable
                haptic="light"
                onPress={() => setSurveyDismissed(true)}
                style={styles.surveyClose}
              >
                <Ionicons name="close" size={16} color={colors.text.tertiary} />
              </AnimatedPressable>
            </View>
          </Reveal>
        ) : null}

        {/* ─── Categories ─── */}
        {services.length > 0 && (
          <Reveal style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t("home.specialties")}</Text>
              <AnimatedPressable
                haptic={false}
                onPress={() => router.push("/(app)/(doctors)/search")}
              >
                <Text style={styles.seeAll}>{t("home.seeAll")}</Text>
              </AnimatedPressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {services.slice(0, 8).map((s, i) => (
                <Reveal key={s.id} index={i} distance={18} pop>
                  <AnimatedPressable
                    haptic="light"
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/(doctors)/search",
                        params: { serviceId: s.id },
                      })
                    }
                    style={styles.cat}
                  >
                    <LinearGradient
                      colors={Gradients.aurora}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.catIcon}
                    >
                      <Ionicons
                        name={iconForService(s.name)}
                        size={24}
                        color="#fff"
                      />
                    </LinearGradient>
                    <Text style={styles.catLabel} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </AnimatedPressable>
                </Reveal>
              ))}
            </ScrollView>
          </Reveal>
        )}

        {/* ─── Banners ─── */}
        <Reveal>
          <BannerCarousel />
        </Reveal>

        {/* ─── Top doctors (focus-scaling carousel) ─── */}
        <Reveal style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t("home.topDoctors")}</Text>
            <AnimatedPressable
              haptic={false}
              onPress={() => router.push("/(app)/(doctors)/search")}
            >
              <Text style={styles.seeAll}>{t("home.seeAll")}</Text>
            </AnimatedPressable>
          </View>
          {loading ? (
            <View style={{ flexDirection: "row", gap: 14 }}>
              <DoctorCardSkeleton />
              <DoctorCardSkeleton />
            </View>
          ) : (
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 6, paddingTop: 4 }}
              onScroll={onCarouselScroll}
              scrollEventThrottle={16}
              snapToInterval={CAROUSEL_STEP}
              decelerationRate="fast"
            >
              {doctors.slice(0, 8).map((doc, i) => (
                <CarouselCard key={doc.id} index={i} scrollX={carouselX}>
                  <DoctorCard
                    doctor={doc}
                    horizontal
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/(doctors)/[id]",
                        params: { id: doc.id },
                      })
                    }
                  />
                </CarouselCard>
              ))}
            </Animated.ScrollView>
          )}
        </Reveal>

        {/* ─── Recommended (list) ─── */}
        <View style={styles.section}>
          <Reveal style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t("home.recommended")}</Text>
          </Reveal>
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <DoctorCardSkeleton key={i} />
              ))
            : doctors.slice(0, 6).map((doc, i) => (
                <Reveal key={doc.id} index={Math.min(i, 2)}>
                  <DoctorCard
                    doctor={doc}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/(doctors)/[id]",
                        params: { id: doc.id },
                      })
                    }
                  />
                </Reveal>
              ))}
        </View>
      </MotionScrollView>

      {/* ─── Frosted compact header (condenses in on scroll) ─── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.stickyHeader, { paddingTop: insets.top }, stickyStyle]}
      >
        <BlurView
          intensity={55}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.stickyInner}>
          <Text style={styles.stickyGreeting} numberOfLines={1}>
            {t(greetingKey())},{" "}
            <Text style={styles.stickyName}>{firstName}</Text>
          </Text>
        </View>
        <View style={styles.stickyHairline} />
      </Animated.View>

      {/* ─── Filter sheet ─── */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {t("home.filterTitle", "Filter doctors")}
              </Text>
              {hasActiveFilters ? (
                <AnimatedPressable haptic="light" onPress={resetFilters}>
                  <Text style={styles.sheetReset}>
                    {t("home.filterReset", "Reset")}
                  </Text>
                </AnimatedPressable>
              ) : null}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
            >
              {/* Consultation type */}
              <Text style={styles.groupLabel}>
                {t("home.filterType", "Consultation type")}
              </Text>
              <View style={styles.chipsWrap}>
                {TYPE_OPTIONS.map((o) => {
                  const active = fType === o.key;
                  return (
                    <AnimatedPressable
                      key={o.key}
                      haptic="light"
                      onPress={() => setFType(o.key)}
                      style={[styles.fChip, active && styles.fChipActive]}
                    >
                      <Text
                        style={[
                          styles.fChipText,
                          active && styles.fChipTextActive,
                        ]}
                      >
                        {t(o.labelKey, o.fallback)}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* Language */}
              <Text style={styles.groupLabel}>
                {t("home.filterLanguage", "Language spoken")}
              </Text>
              <View style={styles.chipsWrap}>
                {[
                  { code: "", native: t("doctors.anyLanguage") },
                  ...ENABLED_LANGUAGES,
                ].map((l) => {
                  const active = fLang === l.code;
                  return (
                    <AnimatedPressable
                      key={"l-" + (l.code || "any")}
                      haptic="light"
                      onPress={() => setFLang(l.code)}
                      style={[styles.fChip, active && styles.fChipActive]}
                    >
                      <Text
                        style={[
                          styles.fChipText,
                          active && styles.fChipTextActive,
                        ]}
                      >
                        {l.native}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* Region */}
              {regions.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>
                    {t("home.filterRegion", "Region")}
                  </Text>
                  <View style={styles.chipsWrap}>
                    {[
                      { code: "", name: t("doctors.allRegions") },
                      ...regions,
                    ].map((r) => {
                      const active = fCountry === r.code;
                      return (
                        <AnimatedPressable
                          key={"r-" + (r.code || "all")}
                          haptic="light"
                          onPress={() => setFCountry(r.code)}
                          style={[styles.fChip, active && styles.fChipActive]}
                        >
                          <Text
                            style={[
                              styles.fChipText,
                              active && styles.fChipTextActive,
                            ]}
                          >
                            {r.name}
                          </Text>
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </ScrollView>

            <AnimatedPressable
              haptic="medium"
              onPress={applyFilters}
              style={styles.applyBtn}
            >
              <Text style={styles.applyTxt}>
                {t("home.filterApply", "Show doctors")}
              </Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    hero: {
      paddingHorizontal: Space.xl,
      paddingBottom: 46,
      borderBottomLeftRadius: Radius.xxl,
      borderBottomRightRadius: Radius.xxl,
      overflow: "hidden",
    },
    heroTop: { flexDirection: "row", alignItems: "center" },
    greeting: { ...Type.bodySm, color: c.text.onDarkDim },
    name: { ...Type.display, color: "#fff", marginTop: 2 },
    bell: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.22)",
    },
    bellDot: {
      position: "absolute",
      top: 12,
      right: 13,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.teal,
      borderWidth: 1.5,
      borderColor: "#143A63",
    },
    tagline: {
      ...Type.body,
      color: c.text.onDark,
      marginTop: 16,
      fontFamily: Fonts.medium,
    },

    // Frosted compact header
    stickyHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      overflow: "hidden",
    },
    stickyInner: {
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Space.xl,
    },
    stickyGreeting: { ...Type.bodySm, color: c.text.secondary },
    stickyName: {
      ...Type.title,
      color: c.text.primary,
      fontFamily: Fonts.extrabold,
    },
    stickyHairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.hairline,
    },

    searchWrap: { paddingHorizontal: Space.xl, marginTop: -26 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      paddingLeft: 16,
      paddingRight: 6,
      height: 58,
      ...Shadow.raised,
    },
    searchInput: { flex: 1, ...Type.bodyMed, color: c.text.primary },
    searchBtn: {
      width: 46,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.navy,
      alignItems: "center",
      justifyContent: "center",
    },
    filterDot: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: c.teal,
      borderWidth: 1.5,
      borderColor: c.navy,
    },

    // Filter sheet
    sheetBackdrop: {
      flex: 1,
      backgroundColor: "rgba(8,16,28,0.5)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      paddingHorizontal: Space.xl,
      paddingTop: 10,
      paddingBottom: 28,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 14,
    },
    sheetHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sheetTitle: {
      ...Type.h3,
      color: c.text.primary,
      fontFamily: Fonts.extrabold,
    },
    sheetReset: {
      ...Type.bodyMed,
      color: c.teal,
      fontFamily: Fonts.semibold,
    },
    groupLabel: {
      ...Type.caption,
      color: c.text.tertiary,
      fontFamily: Fonts.semibold,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 16,
      marginBottom: 10,
    },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    fChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.round,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    fChipActive: { backgroundColor: c.navy, borderColor: c.navy },
    fChipText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
    },
    fChipTextActive: { color: "#fff" },
    applyBtn: {
      marginTop: 20,
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.cta,
    },
    applyTxt: {
      ...Type.bodyMed,
      color: "#fff",
      fontFamily: Fonts.bold,
      fontSize: 16,
    },

    ctaWrap: { paddingHorizontal: Space.xl, marginTop: 22 },
    triageCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: Space.xl,
      marginTop: 14,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    triageIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    triageTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    triageSub: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    surveyCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginHorizontal: Space.xl,
      marginTop: 14,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(44,183,167,0.35)",
      ...Shadow.card,
    },
    surveyIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    surveyTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    surveySub: { ...Type.caption, color: c.text.tertiary, marginTop: 3 },
    surveyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: c.teal,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.round,
      marginTop: 10,
    },
    surveyBtnText: { fontFamily: Fonts.bold, fontSize: 12.5, color: "#fff" },
    surveyClose: { padding: 4 },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: Radius.xl,
      padding: 20,
      overflow: "hidden",
      ...Shadow.raised,
    },
    ctaTitle: { ...Type.h2, color: "#fff" },
    ctaSub: {
      ...Type.bodySm,
      color: c.text.onDark,
      marginTop: 4,
      maxWidth: "92%",
    },
    ctaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#fff",
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.round,
      marginTop: 14,
    },
    ctaBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      color: c.navy,
      letterSpacing: -0.2,
    },
    ctaIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
      marginLeft: 10,
    },

    section: { paddingHorizontal: Space.xl, marginTop: 26 },
    sectionHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: { ...Type.h2, color: c.text.primary },
    seeAll: { ...Type.label, color: c.teal },

    catRow: { gap: 14, paddingRight: 6 },
    cat: { alignItems: "center", width: 76 },
    catIcon: {
      width: 64,
      height: 64,
      borderRadius: Radius.lg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
      ...Shadow.card,
    },
    catLabel: {
      ...Type.caption,
      color: c.text.secondary,
      textAlign: "center",
    },
  });
