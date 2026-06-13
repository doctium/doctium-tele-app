import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { triageApi } from "../../../src/api/triage.api";
import { ASSISTANT_NAME } from "../../../src/constants/assistant";
import {
  LEENAH_LANGUAGES,
  getLeenahAutoPlay,
  getLeenahLanguage,
  setLeenahAutoPlay,
  setLeenahLanguage,
} from "../../../src/utils/leenahPrefs";

interface Message {
  role: "user" | "assistant";
  text: string;
  at: string;
}
interface Verdict {
  urgency:
    | "EMERGENCY"
    | "URGENT_CONSULT"
    | "CONSULT_24H"
    | "ROUTINE"
    | "SELF_CARE";
  specialty: string | null;
  reasons: string[];
  selfCare: string[];
  summary: string;
  redFlag: string | null;
  crisis: boolean;
  programSuggestion: {
    id: string;
    name: string;
    condition: string;
    icon: string;
  } | null;
}
interface QaSuggestion {
  suggestConsult: boolean;
  specialty: string | null;
}
interface Session {
  id: string;
  status: string;
  mode: "TRIAGE" | "QA";
  messages: Message[];
  verdict: Verdict | null;
  qa?: QaSuggestion;
}

const urgencyUi = (c: Palette) => ({
  EMERGENCY: {
    color: c.error,
    bg: "rgba(240,103,92,0.10)",
    icon: "warning" as const,
    label: "Emergency",
  },
  URGENT_CONSULT: {
    color: c.warning,
    bg: "rgba(247,144,9,0.10)",
    icon: "flash" as const,
    label: "See a doctor now",
  },
  CONSULT_24H: {
    color: c.navyMid,
    bg: "rgba(28,74,116,0.08)",
    icon: "time" as const,
    label: "See a doctor within 24 hours",
  },
  ROUTINE: {
    color: c.teal,
    bg: "rgba(44,183,167,0.10)",
    icon: "calendar" as const,
    label: "Book an appointment",
  },
  SELF_CARE: {
    color: c.success,
    bg: "rgba(44,183,167,0.10)",
    icon: "home" as const,
    label: "Manageable at home",
  },
});

export default function SymptomCheckerScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const URGENCY_UI = urgencyUi(colors);
  const [session, setSession] = useState<Session | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [mode, setMode] = useState<"TRIAGE" | "QA">("TRIAGE");
  const [language, setLanguage] = useState("auto");
  const [starting, setStarting] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [qaSuggestion, setQaSuggestion] = useState<QaSuggestion | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Today's allowance (and the DoctiumPlus unlimited flag) for the setup screen.
  const [quota, setQuota] = useState<{
    dailyLimit: number;
    unlimited: boolean;
    used: { TRIAGE: number; QA: number };
  } | null>(null);

  // Accessibility: auto-play Leenah's replies aloud (persisted preference).
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    triageApi
      .getStatus()
      .then((r: unknown) =>
        setQuota(
          (
            r as {
              data: {
                dailyLimit: number;
                unlimited: boolean;
                used: { TRIAGE: number; QA: number };
              };
            }
          ).data,
        ),
      )
      .catch(() => {});
    // Saved preferences (editable anytime from Leenah settings).
    getLeenahAutoPlay().then(setAutoPlay);
    getLeenahLanguage().then(setLanguage);
  }, []);

  const toggleAutoPlay = () => {
    setAutoPlay((v) => {
      const next = !v;
      setLeenahAutoPlay(next);
      return next;
    });
  };

  // Persist the language so it's remembered next time and stays in sync with
  // the Leenah settings page.
  const pickLanguage = (code: string) => {
    setLanguage(code);
    setLeenahLanguage(code);
  };

  // Voice input: record → Whisper transcript → review in the input → send.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    if (thinking || transcribing) return;
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

  const stopRecording = async (use: boolean) => {
    if (recTimer.current) clearInterval(recTimer.current);
    const seconds = recSeconds;
    setRecording(false);
    setRecSeconds(0);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!use || !uri || seconds < 1 || !session) return;
      setTranscribing(true);
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const r: unknown = await triageApi.transcribeVoice(
        session.id,
        b64,
        "audio/m4a",
      );
      const transcript = (r as { data: { transcript: string } }).data
        ?.transcript;
      if (transcript)
        setInput((cur) =>
          cur.trim() ? `${cur.trim()} ${transcript}` : transcript,
        );
    } catch {
    } finally {
      setTranscribing(false);
    }
  };

  // Hard stop at 60s — matches the server's size cap.
  useEffect(() => {
    if (recording && recSeconds >= 60) stopRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, recSeconds]);

  // Voice replies: tap the speaker on any Leenah bubble → TTS → play.
  const player = useAudioPlayer();
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const ttsCache = useRef<Map<number, string>>(new Map());

  const speakBubble = async (idx: number, sess?: Session | null) => {
    const target = sess ?? session;
    if (!target || speakingIdx != null) return;
    try {
      let uri = ttsCache.current.get(idx);
      if (!uri) {
        setSpeakingIdx(idx);
        const r: unknown = await triageApi.speak(target.id, idx);
        const dataUrl = (r as { data: { audio: string } }).data?.audio ?? "";
        const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        if (!b64) return;
        uri = `${FileSystem.cacheDirectory}leenah-${target.id}-${idx}.mp3`;
        await FileSystem.writeAsStringAsync(uri, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        ttsCache.current.set(idx, uri);
      }
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      player.replace({ uri });
      player.play();
    } catch {
    } finally {
      setSpeakingIdx(null);
    }
  };

  const begin = async () => {
    setStarting(true);
    try {
      const r: unknown = await triageApi.startSession({ mode, language });
      const d = (r as { data: Session }).data;
      setSession(d);
      if (autoPlay) speakBubble(0, d); // read the greeting aloud
    } catch (e: unknown) {
      setUnavailable(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "The assistant is unavailable right now.",
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [session?.messages?.length, thinking]);

  const send = async () => {
    const text = input.trim();
    if (!text || !session || thinking) return;
    setInput("");
    setQaSuggestion(null);
    setSession((s) =>
      s
        ? {
            ...s,
            messages: [
              ...s.messages,
              { role: "user", text, at: new Date().toISOString() },
            ],
          }
        : s,
    );
    setThinking(true);
    try {
      const r: unknown = await triageApi.sendMessage(session.id, text);
      const d = (r as { data: Session }).data;
      setSession(d);
      if (autoPlay) {
        // read Leenah's newest reply aloud
        const lastBot = d.messages
          .map((m, i) => ({ role: m.role, i }))
          .filter((m) => m.role === "assistant")
          .at(-1);
        if (lastBot) speakBubble(lastBot.i, d);
      }
      setQaSuggestion(d.qa ?? null);
    } catch {
    } finally {
      setThinking(false);
    }
  };

  const goToDoctors = async (
    action: "INSTANT_CONSULT" | "BOOKED",
    specialty?: string | null,
  ) => {
    if (session) triageApi.setDisposition(session.id, action).catch(() => {});
    router.replace({
      pathname: "/(app)/(doctors)/search",
      params:
        specialty && specialty !== "General practice" ? { q: specialty } : {},
    });
  };

  const dismiss = () => {
    if (session)
      triageApi.setDisposition(session.id, "DISMISSED").catch(() => {});
    router.back();
  };

  const verdict = session?.verdict ?? null;
  const ui = verdict ? URGENCY_UI[verdict.urgency] : null;
  const chatActive = session?.status === "ACTIVE";

  return (
    <View style={styles.root}>
      <AppHeader
        title={`Ask ${ASSISTANT_NAME}`}
        right={
          <AnimatedPressable
            haptic="light"
            onPress={() => router.push("/(app)/(triage)/settings")}
            style={styles.headerGear}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={colors.navyMid}
            />
          </AnimatedPressable>
        }
      />

      {unavailable ? (
        <View style={[styles.center, { paddingHorizontal: 40 }]}>
          <Ionicons
            name="cloud-offline-outline"
            size={36}
            color={colors.text.tertiary}
          />
          <Text style={styles.unavailableTitle}>Not available right now</Text>
          <Text style={styles.unavailableText}>{unavailable}</Text>
        </View>
      ) : !session ? (
        /* ── Setup: what do you need, and in which language? ── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.setup}
        >
          <Text style={styles.setupTitle}>
            How can {ASSISTANT_NAME} help today?
          </Text>
          <Text style={styles.setupSub}>
            {ASSISTANT_NAME} is Doctium's AI health assistant — she guides, your
            doctors decide.
          </Text>
          {[
            {
              m: "TRIAGE" as const,
              icon: "pulse" as const,
              title: "Check my symptoms",
              sub: "A few questions, then we point you to the right care.",
            },
            {
              m: "QA" as const,
              icon: "chatbubbles" as const,
              title: "Ask a health question",
              sub: "General health info — conditions, prevention, nutrition.",
            },
          ].map((o) => (
            <AnimatedPressable
              key={o.m}
              haptic="light"
              onPress={() => setMode(o.m)}
              style={[styles.modeCard, mode === o.m && styles.modeCardSel]}
            >
              <View
                style={[
                  styles.modeIcon,
                  mode === o.m && { backgroundColor: colors.teal },
                ]}
              >
                <Ionicons
                  name={o.icon}
                  size={19}
                  color={mode === o.m ? "#fff" : colors.teal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>{o.title}</Text>
                <Text style={styles.modeSub}>{o.sub}</Text>
              </View>
              <Ionicons
                name={mode === o.m ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={mode === o.m ? colors.teal : colors.border}
              />
            </AnimatedPressable>
          ))}

          <Text style={styles.langLabel}>Language</Text>
          <View style={styles.langRow}>
            {LEENAH_LANGUAGES.map((l) => (
              <AnimatedPressable
                key={l.code}
                haptic="light"
                onPress={() => pickLanguage(l.code)}
                style={[
                  styles.langChip,
                  language === l.code && styles.langChipSel,
                ]}
              >
                <Text
                  style={[
                    styles.langText,
                    language === l.code && { color: "#fff" },
                  ]}
                >
                  {l.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>

          {/* Accessibility: hear Leenah's replies without reading */}
          <AnimatedPressable
            haptic="light"
            onPress={toggleAutoPlay}
            style={styles.autoPlayRow}
          >
            <View
              style={[
                styles.modeIcon,
                autoPlay && { backgroundColor: colors.teal },
              ]}
            >
              <Ionicons
                name={autoPlay ? "volume-high" : "volume-mute"}
                size={18}
                color={autoPlay ? "#fff" : colors.teal}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeTitle}>Read replies aloud</Text>
              <Text style={styles.modeSub}>
                {ASSISTANT_NAME} speaks every reply — helpful if reading is
                hard.
              </Text>
            </View>
            <View
              style={[styles.autoPlayPill, autoPlay && styles.autoPlayPillOn]}
            >
              <Text
                style={[styles.autoPlayPillText, autoPlay && { color: "#fff" }]}
              >
                {autoPlay ? "On" : "Off"}
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            haptic="medium"
            onPress={begin}
            style={styles.startBtn}
          >
            {starting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.startText}>Start</Text>
              </>
            )}
          </AnimatedPressable>
          {quota ? (
            <Text style={styles.quotaLine}>
              {quota.unlimited
                ? "Unlimited with your DoctiumPlus plan ✦"
                : `${Math.max(0, quota.dailyLimit - quota.used[mode])} of ${quota.dailyLimit} ${mode === "QA" ? "questions" : "checks"} left today · unlimited with DoctiumPlus`}
            </Text>
          ) : null}
          <Text style={styles.disclaimer}>
            Health guidance, not a diagnosis. In an emergency call 112.
          </Text>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chat}
          >
            {(session?.messages ?? []).map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    m.role === "user" && { color: "#fff" },
                  ]}
                >
                  {m.text}
                </Text>
                {m.role === "assistant" ? (
                  <AnimatedPressable
                    haptic="light"
                    onPress={() => speakBubble(i)}
                    style={styles.speakBtn}
                  >
                    {speakingIdx === i ? (
                      <ActivityIndicator size="small" color={colors.teal} />
                    ) : (
                      <Ionicons
                        name="volume-medium-outline"
                        size={16}
                        color={colors.teal}
                      />
                    )}
                  </AnimatedPressable>
                ) : null}
              </View>
            ))}
            {thinking ? (
              <View style={[styles.bubble, styles.bubbleBot, styles.thinking]}>
                <ActivityIndicator size="small" color={colors.navyMid} />
                <Text style={styles.thinkingText}>
                  {ASSISTANT_NAME} is thinking…
                </Text>
              </View>
            ) : null}

            {/* Q&A: gentle consult nudge when the answer warrants it */}
            {!verdict && qaSuggestion?.suggestConsult && !thinking ? (
              <AnimatedPressable
                haptic="light"
                onPress={() => goToDoctors("BOOKED", qaSuggestion.specialty)}
                style={styles.qaChip}
              >
                <Ionicons name="medkit" size={14} color={colors.teal} />
                <Text style={styles.qaChipText}>
                  Talk to a doctor about this
                  {qaSuggestion.specialty &&
                  qaSuggestion.specialty !== "General practice"
                    ? ` · ${qaSuggestion.specialty}`
                    : ""}
                </Text>
              </AnimatedPressable>
            ) : null}

            {/* ── Verdict card (triage, or a red flag in either mode) ── */}
            {verdict && ui ? (
              <View style={[styles.verdictCard, { backgroundColor: ui.bg }]}>
                <View style={styles.verdictHead}>
                  <Ionicons name={ui.icon} size={20} color={ui.color} />
                  <Text style={[styles.verdictLabel, { color: ui.color }]}>
                    {ui.label}
                  </Text>
                </View>

                {verdict.specialty &&
                verdict.urgency !== "EMERGENCY" &&
                verdict.urgency !== "SELF_CARE" ? (
                  <Text style={styles.verdictSpecialty}>
                    Suggested: {verdict.specialty}
                  </Text>
                ) : null}

                {(verdict.reasons ?? []).length > 0 && !verdict.crisis ? (
                  <View style={{ marginTop: 8 }}>
                    {verdict.reasons.map((r, i) => (
                      <Text key={i} style={styles.reason}>
                        • {r}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {verdict.urgency === "SELF_CARE" &&
                (verdict.selfCare ?? []).length > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    {verdict.selfCare.map((r, i) => (
                      <Text key={i} style={styles.reason}>
                        ✓ {r}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <View style={styles.ctaCol}>
                  {verdict.urgency === "EMERGENCY" ? (
                    <>
                      <AnimatedPressable
                        haptic="heavy"
                        onPress={() => Linking.openURL("tel:112")}
                        style={[styles.cta, { backgroundColor: colors.error }]}
                      >
                        <Ionicons name="call" size={16} color="#fff" />
                        <Text style={styles.ctaText}>Call 112 now</Text>
                      </AnimatedPressable>
                      {verdict.crisis ? (
                        <AnimatedPressable
                          haptic="medium"
                          onPress={() => goToDoctors("INSTANT_CONSULT")}
                          style={[styles.cta, styles.ctaOutline]}
                        >
                          <Text
                            style={[styles.ctaText, { color: colors.navy }]}
                          >
                            Talk to a doctor today
                          </Text>
                        </AnimatedPressable>
                      ) : null}
                    </>
                  ) : verdict.urgency === "URGENT_CONSULT" ? (
                    <AnimatedPressable
                      haptic="medium"
                      onPress={() =>
                        goToDoctors("INSTANT_CONSULT", verdict.specialty)
                      }
                      style={[styles.cta, { backgroundColor: colors.navy }]}
                    >
                      <Ionicons name="flash" size={15} color="#fff" />
                      <Text style={styles.ctaText}>Start instant consult</Text>
                    </AnimatedPressable>
                  ) : verdict.urgency === "SELF_CARE" ? (
                    <AnimatedPressable
                      haptic="light"
                      onPress={() => goToDoctors("BOOKED", verdict.specialty)}
                      style={[styles.cta, styles.ctaOutline]}
                    >
                      <Text style={[styles.ctaText, { color: colors.navy }]}>
                        Book a doctor anyway
                      </Text>
                    </AnimatedPressable>
                  ) : (
                    <AnimatedPressable
                      haptic="medium"
                      onPress={() => goToDoctors("BOOKED", verdict.specialty)}
                      style={[styles.cta, { backgroundColor: colors.navy }]}
                    >
                      <Ionicons name="calendar" size={15} color="#fff" />
                      <Text style={styles.ctaText}>
                        Book{" "}
                        {verdict.specialty &&
                        verdict.specialty !== "General practice"
                          ? verdict.specialty
                          : "a doctor"}
                      </Text>
                    </AnimatedPressable>
                  )}
                  {verdict.programSuggestion ? (
                    <AnimatedPressable
                      haptic="light"
                      onPress={() => router.push("/(app)/(care)")}
                      style={styles.programCard}
                    >
                      <View style={styles.programIcon}>
                        <Ionicons
                          name={
                            (verdict.programSuggestion.icon &&
                            verdict.programSuggestion.icon in Ionicons.glyphMap
                              ? verdict.programSuggestion.icon
                              : "medkit") as keyof typeof Ionicons.glyphMap
                          }
                          size={18}
                          color={colors.teal}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.programLabel}>
                          {ASSISTANT_NAME} suggests
                        </Text>
                        <Text style={styles.programName}>
                          {verdict.programSuggestion.name}
                        </Text>
                        <Text style={styles.programSub}>
                          Ongoing tracking & check-ins for{" "}
                          {verdict.programSuggestion.condition.toLowerCase()}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={colors.text.tertiary}
                      />
                    </AnimatedPressable>
                  ) : null}
                  <AnimatedPressable
                    haptic="light"
                    onPress={dismiss}
                    style={styles.dismissBtn}
                  >
                    <Text style={styles.dismissText}>Close</Text>
                  </AnimatedPressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {chatActive ? (
            recording ? (
              /* ── Recording bar ── */
              <View style={styles.inputRow}>
                <View style={styles.recBar}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>
                    Recording… 0:{String(recSeconds).padStart(2, "0")}
                  </Text>
                  <Text style={styles.recHint}>up to 1 min</Text>
                </View>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => stopRecording(false)}
                  style={[styles.sendBtn, { backgroundColor: colors.border }]}
                >
                  <Ionicons
                    name="close"
                    size={19}
                    color={colors.text.secondary}
                  />
                </AnimatedPressable>
                <AnimatedPressable
                  haptic="medium"
                  onPress={() => stopRecording(true)}
                  style={styles.sendBtn}
                >
                  <Ionicons name="checkmark" size={19} color="#fff" />
                </AnimatedPressable>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={
                    transcribing
                      ? "Transcribing your voice note…"
                      : session.mode === "QA"
                        ? "Ask a health question…"
                        : "Describe how you're feeling…"
                  }
                  placeholderTextColor={colors.text.tertiary}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  editable={!thinking && !transcribing}
                  multiline
                  maxLength={1000}
                />
                <AnimatedPressable
                  haptic="medium"
                  onPress={startRecording}
                  style={[
                    styles.micBtn,
                    (thinking || transcribing) && { opacity: 0.4 },
                  ]}
                >
                  {transcribing ? (
                    <ActivityIndicator size="small" color={colors.navyMid} />
                  ) : (
                    <Ionicons name="mic" size={19} color={colors.navyMid} />
                  )}
                </AnimatedPressable>
                <AnimatedPressable
                  haptic="light"
                  onPress={send}
                  style={[
                    styles.sendBtn,
                    (!input.trim() || thinking || transcribing) && {
                      opacity: 0.4,
                    },
                  ]}
                >
                  <Ionicons name="arrow-up" size={19} color="#fff" />
                </AnimatedPressable>
              </View>
            )
          ) : null}
          <Text style={styles.disclaimer}>
            Health guidance, not a diagnosis. In an emergency call 112.
          </Text>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    headerGear: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
      ...Shadow.card,
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    unavailableTitle: { ...Type.h3, color: c.text.primary, marginTop: 6 },
    unavailableText: {
      ...Type.bodySm,
      color: c.text.tertiary,
      textAlign: "center",
    },

    setup: { paddingHorizontal: Space.xl, paddingTop: 14, paddingBottom: 40 },
    setupTitle: { ...Type.h2, color: c.text.primary },
    setupSub: {
      ...Type.caption,
      color: c.text.tertiary,
      marginTop: 4,
      marginBottom: 14,
    },
    modeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 15,
      marginBottom: 10,
      borderWidth: 1.5,
      borderColor: "transparent",
      ...Shadow.card,
    },
    modeCardSel: { borderColor: c.teal },
    modeIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    modeTitle: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    modeSub: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    langLabel: {
      ...Type.overline,
      color: c.text.tertiary,
      marginTop: 14,
      marginBottom: 10,
      marginLeft: 4,
    },
    langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    langChip: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: Radius.round,
    },
    langChipSel: { backgroundColor: c.navy, borderColor: "transparent" },
    langText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
    },
    startBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.teal,
      paddingVertical: 15,
      borderRadius: Radius.round,
      marginTop: 22,
    },
    startText: { fontFamily: Fonts.bold, fontSize: 15, color: "#fff" },
    autoPlayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 15,
      marginTop: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    autoPlayPill: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 13,
      paddingVertical: 6,
      borderRadius: Radius.round,
    },
    autoPlayPillOn: {
      backgroundColor: c.teal,
      borderColor: "transparent",
    },
    autoPlayPillText: {
      fontFamily: Fonts.bold,
      fontSize: 12.5,
      color: c.text.secondary,
    },
    quotaLine: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 10,
    },

    chat: { paddingHorizontal: Space.xl, paddingVertical: 14, gap: 10 },
    bubble: {
      maxWidth: "84%",
      borderRadius: Radius.xl,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    bubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: c.navy,
      borderBottomRightRadius: 6,
    },
    bubbleBot: {
      alignSelf: "flex-start",
      backgroundColor: c.surface,
      borderBottomLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    bubbleText: { ...Type.bodySm, color: c.text.primary, lineHeight: 20 },
    thinking: { flexDirection: "row", alignItems: "center", gap: 8 },
    speakBtn: { alignSelf: "flex-start", marginTop: 8, padding: 2 },
    programCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(44,183,167,0.35)",
      borderRadius: Radius.lg,
      padding: 13,
      marginTop: 2,
    },
    programIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(44,183,167,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    programLabel: {
      ...Type.caption,
      fontSize: 10,
      color: c.teal,
      fontFamily: Fonts.bold,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    programName: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.text.primary,
      marginTop: 1,
    },
    programSub: { ...Type.caption, color: c.text.tertiary, marginTop: 1 },
    thinkingText: { ...Type.caption, color: c.text.tertiary },

    qaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "flex-start",
      backgroundColor: "rgba(44,183,167,0.10)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(44,183,167,0.35)",
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: Radius.round,
    },
    qaChipText: {
      fontFamily: Fonts.bold,
      fontSize: 12.5,
      color: c.tealDeep,
    },

    verdictCard: { borderRadius: Radius.xl, padding: 16, marginTop: 6 },
    verdictHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    verdictLabel: {
      fontFamily: Fonts.extrabold,
      fontSize: 16,
      letterSpacing: -0.2,
    },
    verdictSpecialty: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.text.primary,
      marginTop: 8,
    },
    reason: {
      ...Type.caption,
      color: c.text.secondary,
      marginTop: 3,
      lineHeight: 17,
    },
    ctaCol: { gap: 8, marginTop: 14 },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: Radius.round,
    },
    ctaOutline: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    ctaText: { fontFamily: Fonts.bold, fontSize: 14, color: "#fff" },
    dismissBtn: { alignItems: "center", paddingVertical: 8 },
    dismissText: {
      ...Type.bodySm,
      fontFamily: Fonts.bold,
      color: c.text.tertiary,
    },

    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: Space.xl,
      paddingTop: 8,
    },
    input: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.xl,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      maxHeight: 110,
      fontFamily: Fonts.medium,
      fontSize: 15,
      color: c.text.primary,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
    },
    micBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.navySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    recBar: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(240,103,92,0.45)",
      borderRadius: Radius.xl,
      paddingHorizontal: 16,
      height: 44,
    },
    recDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.error,
    },
    recText: {
      fontFamily: Fonts.bold,
      fontSize: 13.5,
      color: c.text.primary,
      flex: 1,
    },
    recHint: { ...Type.caption, fontSize: 10.5, color: c.text.tertiary },
    disclaimer: {
      ...Type.caption,
      fontSize: 10.5,
      color: c.text.tertiary,
      textAlign: "center",
      paddingVertical: 8,
    },
  });
