import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Palette,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AppHeader } from "../../../src/components/ui";
import { DoctorCard } from "../../../src/components/doctor/DoctorCard";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchFavorites } from "../../../src/store/slices/favoritesSlice";

export default function FavoritesScreen() {
  const dispatch = useAppDispatch();
  const { doctors, loading } = useAppSelector((s) => s.favorites);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const load = useCallback(async () => {
    await dispatch(fetchFavorites());
  }, [dispatch]);
  useEffect(() => {
    load();
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.root}>
      <AppHeader title={t("favorites.title")} />
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navy} size="large" />
        </View>
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.navy}
            />
          }
          renderItem={({ item }) => (
            <DoctorCard
              doctor={item}
              onPress={() =>
                router.push({
                  pathname: "/(app)/(doctors)/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="heart-outline"
                size={44}
                color={colors.text.tertiary}
              />
              <Text style={styles.emptyTitle}>{t("favorites.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("favorites.emptyText")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: {
      paddingHorizontal: Space.xl,
      paddingTop: 6,
      paddingBottom: 130,
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 100,
      paddingHorizontal: 40,
      gap: 10,
    },
    emptyTitle: { ...Type.h3, color: c.text.primary },
    emptyText: {
      ...Type.bodySm,
      color: c.text.tertiary,
      textAlign: "center",
      lineHeight: 20,
    },
  });
