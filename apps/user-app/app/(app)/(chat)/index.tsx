import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Palette,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable } from "../../../src/components/ui";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { chatApi } from "../../../src/api/chat.api";

interface ChatTopic {
  id: string;
  chats: {
    message?: string;
    createdAt: string;
    doctor?: { name: string; image?: string };
  }[];
}

export default function ChatListScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      chatApi
        .getTopics()
        .then((r: unknown) =>
          setTopics((r as { data: ChatTopic[] }).data ?? []),
        )
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("chat.list.title")}</Text>
        <Text style={styles.subtitle}>{t("chat.list.subtitle")}</Text>
      </View>

      {!loading && topics.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t("chat.list.emptyTitle")}
          description={t("chat.list.emptyDescription")}
        />
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(topic) => topic.id}
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
            const doctor = last?.doctor;
            return (
              <AnimatedPressable
                haptic="light"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(chat)/[topicId]",
                    params: { topicId: item.id, doctorName: doctor?.name },
                  })
                }
                style={styles.thread}
              >
                <Avatar
                  name={doctor?.name}
                  uri={doctor?.image}
                  size={54}
                  ring
                />
                <View style={styles.threadInfo}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {doctor?.name ?? t("chat.list.doctorFallback")}
                  </Text>
                  <Text style={styles.threadPreview} numberOfLines={1}>
                    {last?.message ?? t("chat.list.startConversation")}
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
    threadInfo: { flex: 1 },
    threadName: { ...Type.title, color: c.text.primary },
    threadPreview: { ...Type.bodySm, color: c.text.secondary, marginTop: 3 },
    time: { ...Type.caption, color: c.text.tertiary },
  });
