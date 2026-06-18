import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import {
  Gradients,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable } from "../../../src/components/ui";
import { chatApi } from "../../../src/api/chat.api";

interface Message {
  id: string;
  role: string;
  messageType: string;
  message?: string;
  image?: string;
  createdAt: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export default function PersonalChatScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const { topicId, doctorId, doctorName } = useLocalSearchParams<{
    topicId: string;
    doctorId?: string;
    doctorName?: string;
  }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    chatApi
      .getMessages(topicId)
      .then((r: unknown) => setMessages((r as { data: Message[] }).data ?? []));
    SecureStore.getItemAsync("accessToken").then((token) => {
      const socket = io(`${API_URL}/chat`, {
        query: { topicId },
        auth: { token },
      });
      socketRef.current = socket;
      socket.on("newMessage", (msg: Message) =>
        setMessages((prev) => [...prev, msg]),
      );
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, [topicId]);

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit("sendMessage", {
      chatTopicId: topicId,
      doctorId,
      role: "user",
      messageType: "TEXT",
      message: input,
    });
    setInput("");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AnimatedPressable
          haptic="light"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </AnimatedPressable>
        <Avatar name={doctorName} size={42} ring />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {doctorName ?? t("chat.thread.doctorFallback")}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.headerStatus}>{t("chat.thread.online")}</Text>
          </View>
        </View>
        <AnimatedPressable
          haptic="light"
          onPress={() =>
            router.push({ pathname: "/(app)/(chat)/call", params: { topicId } })
          }
          style={styles.callBtn}
        >
          <Ionicons name="videocam" size={20} color={colors.teal} />
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item: m }) => {
            const mine = m.role === "user";
            const time = new Date(m.createdAt).toLocaleTimeString("en-NG", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <View
                style={[
                  styles.bubbleWrap,
                  mine ? styles.wrapMine : styles.wrapTheirs,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: mine ? "#fff" : colors.text.primary },
                    ]}
                  >
                    {m.message}
                  </Text>
                </View>
                <Text style={styles.bubbleTime}>{time}</Text>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={t("chat.thread.inputPlaceholder")}
            placeholderTextColor={colors.text.tertiary}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <AnimatedPressable
            haptic="medium"
            onPress={sendMessage}
            style={styles.sendWrap}
          >
            <LinearGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: Space.lg,
      paddingVertical: 12,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    headerInfo: { flex: 1 },
    headerName: { ...Type.title, color: c.text.primary },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.teal,
    },
    headerStatus: { ...Type.caption, color: c.tealDeep },
    callBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.tealSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    msgList: { padding: Space.lg, gap: 4 },
    bubbleWrap: { maxWidth: "78%", marginBottom: 8 },
    wrapMine: { alignSelf: "flex-end", alignItems: "flex-end" },
    wrapTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
    bubble: {
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    bubbleMine: { backgroundColor: c.navy, borderBottomRightRadius: 6 },
    bubbleTheirs: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    bubbleText: { ...Type.bodyMed, lineHeight: 21 },
    bubbleTime: {
      ...Type.caption,
      color: c.text.tertiary,
      fontSize: 11,
      marginTop: 4,
      marginHorizontal: 4,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: Space.lg,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    textInput: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      ...Type.bodyMed,
      color: c.text.primary,
      maxHeight: 110,
    },
    sendWrap: { ...Shadow.cta, borderRadius: 23 },
    sendBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
  });
