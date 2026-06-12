import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  FlatListProps,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  Fonts,
  Motion,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable } from "../../../src/components/ui";
import { DoctorCard } from "../../../src/components/doctor/DoctorCard";
import { DoctorCardSkeleton } from "../../../src/components/common/SkeletonLoader";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchDoctors } from "../../../src/store/slices/doctorsSlice";
import { regionsApi } from "../../../src/api/regions.api";
import { ENABLED_LANGUAGES } from "../../../src/i18n/languages";

// Filter keys are stable; display labels are translated at render time.
const FILTERS = ["All", "Online", "Clinic", "Top rated"];
const FILTER_KEY: Record<string, string> = {
  All: "doctors.filterAll",
  Online: "doctors.filterOnline",
  Clinic: "doctors.filterClinic",
  "Top rated": "doctors.filterTopRated",
};
interface Region {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
}

/** Horizontal filter chip row that cascades in on mount. */
function FilterRow<T>({
  index,
  ...props
}: { index: number } & Omit<FlatListProps<T>, "horizontal">) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Animated.View
      entering={FadeInDown.delay(70 + index * Motion.stagger)
        .springify()
        .damping(18)}
    >
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filtersRow}
        {...props}
      />
    </Animated.View>
  );
}

export default function SearchScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const {
    q,
    serviceId,
    type: typeParam,
    language: langParam,
    country: countryParam,
  } = useLocalSearchParams<{
    q?: string;
    serviceId?: string;
    type?: string;
    language?: string;
    country?: string;
  }>();
  const { list, loading } = useAppSelector((s) => s.doctors);
  const [search, setSearch] = useState(q ?? "");
  // Initial filter state can be seeded from the home filter sheet via params.
  const [filter, setFilter] = useState(typeParam ?? "All");
  const [refreshing, setRefreshing] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [country, setCountry] = useState(countryParam ?? ""); // '' = all regions
  const [nationality, setNationality] = useState(""); // '' = any nationality
  const [language, setLanguage] = useState(langParam ?? ""); // '' = any language

  useEffect(() => {
    regionsApi
      .getAvailable()
      .then((r: unknown) => setRegions((r as { data: Region[] }).data ?? []))
      .catch(() => {});
    regionsApi
      .getAll()
      .then((r: unknown) => setAllRegions((r as { data: Region[] }).data ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(
    () =>
      dispatch(
        fetchDoctors({
          search: search || undefined,
          serviceId,
          country: country || undefined,
          nationality: nationality || undefined,
          language: language || undefined,
        }),
      ),
    [dispatch, search, serviceId, country, nationality, language],
  );
  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered =
    filter === "Top rated"
      ? [...list].sort((a, b) => b.rating - a.rating)
      : filter === "Online"
        ? list.filter((d) => d.isOnline)
        : filter === "Clinic"
          ? list.filter((d) => d.type === "CLINIC" || d.type === "BOTH")
          : list;

  const regionName = country
    ? (regions.find((r) => r.code === country)?.name ?? country)
    : t("doctors.allRegions");

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        style={styles.topBar}
      >
        <AnimatedPressable
          haptic="light"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </AnimatedPressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.input}
            placeholder={t("doctors.searchPlaceholder")}
            placeholderTextColor={colors.text.tertiary}
            value={search}
            onChangeText={setSearch}
            autoFocus={!serviceId}
            returnKeyType="search"
          />
          {search ? (
            <AnimatedPressable haptic={false} onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>
          ) : null}
        </View>
      </Animated.View>

      {/* Region */}
      <FilterRow
        index={0}
        data={[
          { code: "", name: t("doctors.allRegions") } as Region,
          ...regions,
        ]}
        keyExtractor={(r) => r.code || "all"}
        renderItem={({ item: r }) => {
          const active = country === r.code;
          return (
            <AnimatedPressable
              haptic="light"
              onPress={() => setCountry(r.code)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name="location-outline"
                size={13}
                color={active ? "#fff" : colors.text.tertiary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {r.name}
              </Text>
            </AnimatedPressable>
          );
        }}
      />

      {/* Nationality (diaspora affinity) */}
      <FilterRow
        index={1}
        data={[
          { code: "", name: t("doctors.anyNationality") } as Region,
          ...allRegions,
        ]}
        keyExtractor={(r) => "nat-" + (r.code || "any")}
        renderItem={({ item: r }) => {
          const active = nationality === r.code;
          return (
            <AnimatedPressable
              haptic="light"
              onPress={() => setNationality(r.code)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {r.code ? t("doctors.fromRegion", { name: r.name }) : r.name}
              </Text>
            </AnimatedPressable>
          );
        }}
      />

      {/* Type / rating */}
      <FilterRow
        index={2}
        data={FILTERS}
        keyExtractor={(f) => f}
        renderItem={({ item: f }) => {
          const active = filter === f;
          return (
            <AnimatedPressable
              haptic="light"
              onPress={() => setFilter(f)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(FILTER_KEY[f] ?? f)}
              </Text>
            </AnimatedPressable>
          );
        }}
      />

      {/* Language spoken — helps patients find a doctor who speaks their language */}
      <FilterRow
        index={3}
        data={[
          { code: "", native: t("doctors.anyLanguage") },
          ...ENABLED_LANGUAGES,
        ]}
        keyExtractor={(l) => "lang-" + (l.code || "any")}
        renderItem={({ item: l }) => {
          const active = language === l.code;
          return (
            <AnimatedPressable
              haptic="light"
              onPress={() => setLanguage(l.code)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name="language-outline"
                size={13}
                color={active ? "#fff" : colors.text.tertiary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {l.native}
              </Text>
            </AnimatedPressable>
          );
        }}
      />

      {loading ? (
        <View style={styles.list}>
          {Array.from({ length: 5 }, (_, i) => (
            <DoctorCardSkeleton key={i} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <Animated.View
          entering={FadeInUp.springify().damping(16)}
          style={{ flex: 1 }}
        >
          <EmptyState
            icon="search-outline"
            title={t("doctors.noneFound")}
            description={
              country
                ? t("doctors.noneInRegion", { region: regionName })
                : t("doctors.tryDifferent")
            }
          />
        </Animated.View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
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
          ListHeaderComponent={
            <Text style={styles.count}>
              {filtered.length === 1
                ? t("doctors.resultOne", {
                    count: filtered.length,
                    region: regionName,
                  })
                : t("doctors.resultMany", {
                    count: filtered.length,
                    region: regionName,
                  })}
            </Text>
          }
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(index < 8 ? index * 55 : 0)
                .springify()
                .damping(18)}
            >
              <DoctorCard
                doctor={item}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(doctors)/[id]",
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Space.xl,
      gap: 12,
      marginBottom: 12,
    },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.card,
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      height: 50,
      gap: 8,
      ...Shadow.card,
    },
    input: { flex: 1, ...Type.bodyMed, color: c.text.primary },
    filterScroll: { flexGrow: 0, marginBottom: 8 },
    filtersRow: { paddingHorizontal: Space.xl, gap: 10 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.round,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.navy, borderColor: c.navy },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
      letterSpacing: -0.1,
    },
    chipTextActive: { color: "#fff" },
    list: { paddingHorizontal: Space.xl, paddingTop: 6, paddingBottom: 120 },
    count: { ...Type.caption, color: c.text.tertiary, marginBottom: 12 },
  });
