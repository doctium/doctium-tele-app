import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { doctorApi } from "../../../src/api/doctor.api";

interface Topic {
  id: string;
  chats: {
    message?: string;
    createdAt: string;
    user?: { name: string; image?: string };
  }[];
}

export default function DoctorChatScreen() {
  const insets = useSafeAreaInsets();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const load = useCallback(
    () =>
      doctorApi
        .getChatTopics()
        .then((r: unknown) => setTopics((r as { data: Topic[] }).data ?? []))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Conversations with your patients</Text>
      </View>

      {topics.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No patient messages"
          description="Your conversations with patients will appear here."
        />
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(t) => t.id}
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
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const last = item.chats[item.chats.length - 1];
            const patient = last?.user;
            return (
              <AnimatedPressable
                haptic="light"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(chat)/[topicId]",
                    params: { topicId: item.id, patientName: patient?.name },
                  })
                }
                style={styles.thread}
              >
                <Avatar
                  name={patient?.name}
                  uri={patient?.image}
                  size={54}
                  ring
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {patient?.name ?? "Patient"}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {last?.message ?? "New conversation"}
                  </Text>
                </View>
                <Text style={styles.time}>
                  {last
                    ? new Date(last.createdAt).toLocaleTimeString("en-NG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </Text>
              </AnimatedPressable>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: Space.xl, marginBottom: 12 },
    title: { ...Type.display, color: c.text.primary },
    subtitle: { ...Type.body, color: c.text.secondary, marginTop: 4 },
    list: { paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 120 },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 66,
    },
    thread: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
    },
    name: { ...Type.title, color: c.text.primary },
    preview: { ...Type.bodySm, color: c.text.secondary, marginTop: 3 },
    time: { ...Type.caption, color: c.text.tertiary },
  });
