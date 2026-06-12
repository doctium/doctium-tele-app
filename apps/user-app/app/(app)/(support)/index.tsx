import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import {
  Gradients,
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable } from "../../../src/components/ui";
import { supportApi } from "../../../src/api/support.api";

interface Msg {
  id: string;
  sender: "USER" | "ADMIN";
  senderName?: string;
  type: "TEXT" | "IMAGE" | "AUDIO";
  body?: string;
  mediaUrl?: string;
  durationSec?: number | null;
  createdAt: string;
}

const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

async function uriToDataUrl(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fmtDur(s?: number | null) {
  const n = Math.max(0, Math.round(s ?? 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

export default function SupportChatScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const flatRef = useRef<FlatList>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();

  const upsert = (m: Msg) =>
    setMessages((prev) =>
      prev.some((x) => x.id === m.id) ? prev : [...prev, m],
    );

  useEffect(() => {
    supportApi
      .getThread()
      .then((r: unknown) =>
        setMessages((r as { data: { messages: Msg[] } }).data?.messages ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));

    SecureStore.getItemAsync("accessToken").then((token) => {
      const socket = io(`${API_ORIGIN}/support`, {
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;
      socket.on("support:newMessage", ({ message }: { message: Msg }) =>
        upsert(message),
      );
    });
    return () => {
      socketRef.current?.disconnect();
      if (recTimer.current) clearInterval(recTimer.current);
    };
  }, []);

  const post = async (
    payload: Parameters<typeof supportApi.sendMessage>[0],
  ) => {
    setSending(true);
    try {
      const r = (await supportApi.sendMessage(payload)) as { data: Msg };
      if (r.data) upsert(r.data);
      setInput("");
    } catch {
      /* interceptor / silent */
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    if (input.trim()) post({ type: "TEXT", body: input.trim() });
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.6,
    });
    const a = res.assets?.[0];
    if (!res.canceled && a?.base64) {
      post({
        type: "IMAGE",
        dataUrl: `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}`,
        fileName: a.fileName ?? undefined,
      });
    }
  };

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecSeconds(0);
      recTimer.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setRecording(false);
    }
  };

  const stopRecording = async (send: boolean) => {
    if (recTimer.current) clearInterval(recTimer.current);
    const seconds = recSeconds;
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (send && uri && seconds > 0) {
        setSending(true);
        const dataUrl = await uriToDataUrl(uri);
        await post({
          type: "AUDIO",
          dataUrl,
          fileName: "voice.m4a",
          durationSec: seconds,
        });
      }
    } catch {
      /* silent */
    } finally {
      setSending(false);
      setRecSeconds(0);
    }
  };

  const playAudio = (uri?: string) => {
    if (!uri) return;
    try {
      player.replace({ uri });
      player.play();
    } catch {
      /* silent */
    }
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
        <View style={styles.logoDot}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>Doctium Support</Text>
          <Text style={styles.headerStatus}>
            We typically reply within a day
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.navy} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.msgList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={40}
                  color={colors.text.tertiary}
                />
                <Text style={styles.emptyText}>
                  Send us a message — questions, issues, anything. We&apos;re
                  here to help.
                </Text>
              </View>
            }
            renderItem={({ item: m }) => {
              const mine = m.sender === "USER";
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
                    {m.type === "IMAGE" && m.mediaUrl ? (
                      <Image
                        source={{ uri: m.mediaUrl }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    ) : m.type === "AUDIO" ? (
                      <AnimatedPressable
                        haptic="light"
                        onPress={() => playAudio(m.mediaUrl)}
                        style={styles.audioRow}
                      >
                        <Ionicons
                          name="play-circle"
                          size={28}
                          color={mine ? "#fff" : colors.navy}
                        />
                        <View
                          style={[
                            styles.audioBar,
                            {
                              backgroundColor: mine
                                ? "rgba(255,255,255,0.35)"
                                : colors.border,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.audioDur,
                            { color: mine ? "#fff" : colors.text.secondary },
                          ]}
                        >
                          {fmtDur(m.durationSec)}
                        </Text>
                      </AnimatedPressable>
                    ) : (
                      <Text
                        style={[
                          styles.bubbleText,
                          { color: mine ? "#fff" : colors.text.primary },
                        ]}
                      >
                        {m.body}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.bubbleTime}>{time}</Text>
                </View>
              );
            }}
          />
        )}

        {recording ? (
          <View style={styles.recBar}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Recording… {fmtDur(recSeconds)}</Text>
            <AnimatedPressable
              haptic="light"
              onPress={() => stopRecording(false)}
              style={styles.recCancel}
            >
              <Text style={styles.recCancelText}>Cancel</Text>
            </AnimatedPressable>
            <AnimatedPressable
              haptic="medium"
              onPress={() => stopRecording(true)}
              style={styles.recSendWrap}
            >
              <LinearGradient
                colors={Gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.recSend}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </LinearGradient>
            </AnimatedPressable>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <AnimatedPressable
              haptic="light"
              onPress={pickImage}
              disabled={sending}
              style={styles.iconBtn}
            >
              <Ionicons name="image-outline" size={22} color={colors.navyMid} />
            </AnimatedPressable>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message…"
              placeholderTextColor={colors.text.tertiary}
              value={input}
              onChangeText={setInput}
              multiline
            />
            {input.trim() ? (
              <AnimatedPressable
                haptic="medium"
                onPress={sendText}
                disabled={sending}
                style={styles.sendWrap}
              >
                <LinearGradient
                  colors={Gradients.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtn}
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </LinearGradient>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                haptic="medium"
                onPress={startRecording}
                disabled={sending}
                style={styles.iconBtn}
              >
                <Ionicons name="mic-outline" size={24} color={colors.navyMid} />
              </AnimatedPressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    logoDot: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.navy,
      alignItems: "center",
      justifyContent: "center",
    },
    headerInfo: { flex: 1 },
    headerName: { ...Type.title, color: c.text.primary },
    headerStatus: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 2,
    },
    msgList: { padding: Space.lg, gap: 4, flexGrow: 1 },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyText: {
      ...Type.bodySm,
      color: c.text.tertiary,
      textAlign: "center",
      lineHeight: 20,
    },
    bubbleWrap: { maxWidth: "80%", marginBottom: 8 },
    wrapMine: { alignSelf: "flex-end", alignItems: "flex-end" },
    wrapTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
    bubble: {
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
      overflow: "hidden",
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
    bubbleImage: {
      width: 200,
      height: 200,
      borderRadius: Radius.md,
      marginHorizontal: -4,
      marginVertical: -2,
    },
    audioRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minWidth: 150,
    },
    audioBar: { flex: 1, height: 4, borderRadius: 2 },
    audioDur: { ...Type.caption, fontFamily: Fonts.semibold },
    bubbleTime: {
      ...Type.caption,
      color: c.text.tertiary,
      fontSize: 11,
      marginTop: 4,
      marginHorizontal: 4,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: Space.lg,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
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
    recBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: Space.lg,
      paddingVertical: 12,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    recDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: c.error,
    },
    recText: { flex: 1, ...Type.bodyMed, color: c.text.primary },
    recCancel: { paddingHorizontal: 12, paddingVertical: 8 },
    recCancelText: { ...Type.label, color: c.text.secondary },
    recSendWrap: { ...Shadow.cta, borderRadius: 23 },
    recSend: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
  });
