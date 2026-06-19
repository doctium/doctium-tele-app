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
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
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

const urgencyUi = (c: Palette, t: (key: string) => string) => ({
  EMERGENCY: {
    color: c.error,
    bg: "rgba(240,103,92,0.10)",
    icon: "warning" as const,
    label: t("triage.urgency.emergency"),
  },
  URGENT_CONSULT: {
    color: c.warning,
    bg: "rgba(247,144,9,0.10)",
    icon: "flash" as const,
    label: t("triage.urgency.seeDoctorNow"),
  },
  CONSULT_24H: {
    color: c.navyMid,
    bg: "rgba(28,74,116,0.08)",
    icon: "time" as const,
    label: t("triage.urgency.seeDoctor24h"),
  },
  ROUTINE: {
    color: c.teal,
    bg: "rgba(44,183,167,0.10)",
    icon: "calendar" as const,
    label: t("triage.urgency.bookAppointment"),
  },
  SELF_CARE: {
    color: c.success,
    bg: "rgba(44,183,167,0.10)",
    icon: "home" as const,
    label: t("triage.urgency.manageableAtHome"),
  },
});

// Hands-free voice-activity detection tuning (energy-based; thresholds may need
// on-device calibration). Read the mic level, learn the ambient floor, treat
// anything a margin above it as speech, and end the turn after a short silence.
const VAD_INTERVAL_MS = 120; // how often we sample the mic level
const VAD_CALIB_TICKS = 5; // ~600ms to learn the room's noise floor
const VAD_VOICE_MARGIN_DB = 9; // dB above ambient that counts as the patient talking
const VAD_SILENCE_TICKS = 13; // ~1.5s of quiet ends the turn

export default function SymptomCheckerScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const URGENCY_UI = urgencyUi(colors, t);
  const [session, setSession] = useState<Session | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [mode, setMode] = useState<"TRIAGE" | "QA">("TRIAGE");
  const [language, setLanguage] = useState("auto");
  const [starting, setStarting] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [qaSuggestion, setQaSuggestion] = useState<QaSuggestion | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // "voice=1" → launched from the global Talk-to-Leenah button (hands-free mode).
  const params = useLocalSearchParams<{ voice?: string }>();
  const voiceMode = params.voice === "1";

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
  // Metering on so hands-free VAD can read the mic level and auto-stop.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice UX: a transient error banner + the hands-free auto-send countdown.
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSendIn, setAutoSendIn] = useState<number | null>(null);
  const autoSendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef("");
  // Hands-free voice-activity detection: poll the mic level while recording and
  // auto-stop when the patient goes quiet. Degrades to the manual ✓ button if a
  // device doesn't deliver metering.
  const vadTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadState = useRef({
    calib: [] as number[],
    floor: null as number | null,
    speech: false,
    silent: 0,
    ticks: 0,
  });
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  useEffect(
    () => () => {
      if (voiceErrTimer.current) clearTimeout(voiceErrTimer.current);
      if (autoSendTimer.current) clearInterval(autoSendTimer.current);
      if (vadTimer.current) clearInterval(vadTimer.current);
    },
    [],
  );

  const cancelAutoSend = () => {
    if (autoSendTimer.current) clearInterval(autoSendTimer.current);
    autoSendTimer.current = null;
    setAutoSendIn(null);
  };

  const showVoiceError = (msg: string) => {
    cancelAutoSend();
    if (voiceErrTimer.current) clearTimeout(voiceErrTimer.current);
    setVoiceError(msg);
    voiceErrTimer.current = setTimeout(() => setVoiceError(null), 4500);
  };

  // Hands-free: after a transcript, send it automatically unless the patient
  // taps to edit first — a short countdown so a bad transcript can be caught.
  const scheduleAutoSend = (text: string) => {
    cancelAutoSend();
    let n = 3;
    setAutoSendIn(n);
    autoSendTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        cancelAutoSend();
        send(text);
      } else {
        setAutoSendIn(n);
      }
    }, 1000);
  };

  const stopVad = () => {
    if (vadTimer.current) clearInterval(vadTimer.current);
    vadTimer.current = null;
  };

  const startVad = () => {
    stopVad();
    vadState.current = {
      calib: [],
      floor: null,
      speech: false,
      silent: 0,
      ticks: 0,
    };
    vadTimer.current = setInterval(() => {
      const lvl = recorder.getStatus().metering;
      if (lvl == null || !Number.isFinite(lvl)) return; // no metering → manual ✓
      const s = vadState.current;
      s.ticks += 1;
      if (s.ticks <= VAD_CALIB_TICKS) {
        // Learn the room's ambient floor from the first reads.
        s.calib.push(lvl);
        if (s.ticks === VAD_CALIB_TICKS)
          s.floor = s.calib.reduce((a, b) => a + b, 0) / s.calib.length;
        return;
      }
      const threshold = (s.floor ?? -50) + VAD_VOICE_MARGIN_DB;
      if (lvl > threshold) {
        s.speech = true;
        s.silent = 0;
      } else if (s.speech && (s.silent += 1) >= VAD_SILENCE_TICKS) {
        stopRecording(true); // pause detected → transcribe → (voice) auto-send
      }
    }, VAD_INTERVAL_MS);
  };

  const startRecording = async () => {
    if (thinking || transcribing) return;
    cancelAutoSend();
    setVoiceError(null);
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
      if (voiceMode) startVad(); // hands-free: auto-stop when the patient pauses
    } catch {
      setRecording(false);
    }
  };

  const stopRecording = async (use: boolean) => {
    stopVad();
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
      if (transcript) {
        const next = inputRef.current.trim()
          ? `${inputRef.current.trim()} ${transcript}`
          : transcript;
        setInput(next);
        if (voiceMode) scheduleAutoSend(next); // hands-free: send unless edited
      } else {
        showVoiceError(t("triage.voice.notCaught"));
      }
    } catch {
      showVoiceError(t("triage.voice.unreachable"));
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
  const playerStatus = useAudioPlayerStatus(player);
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

  const begin = async (opts?: { speakGreeting?: boolean }) => {
    setStarting(true);
    try {
      const r: unknown = await triageApi.startSession({ mode, language });
      const d = (r as { data: Session }).data;
      setSession(d);
      if (autoPlay || opts?.speakGreeting) speakBubble(0, d); // read the greeting aloud
    } catch (e: unknown) {
      setUnavailable(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("triage.unavailableNow"),
      );
    } finally {
      setStarting(false);
    }
  };

  // Hands-free voice mode: auto-start the session (speaking the greeting), then
  // open the mic shortly after so the user can just talk.
  const voiceBeganRef = useRef(false);
  const voiceRecRef = useRef(false);
  const greetingPlayedRef = useRef(false);
  useEffect(() => {
    if (voiceMode && !voiceBeganRef.current && !session && !starting) {
      voiceBeganRef.current = true;
      begin({ speakGreeting: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode, session, starting]);

  // Hands-free: open the mic only once Leenah's spoken greeting has finished,
  // so she doesn't record her own voice through the speaker. Watch playback
  // start (playing → true), then stop (playing → false), then hand the mic over.
  useEffect(() => {
    if (!voiceMode || !session || voiceRecRef.current) return;
    if (playerStatus.playing) {
      greetingPlayedRef.current = true;
    } else if (greetingPlayedRef.current) {
      voiceRecRef.current = true;
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode, session, playerStatus.playing]);

  // Safety net: if the greeting never plays (e.g. TTS unavailable or offline),
  // still open the mic so the screen doesn't sit there waiting forever.
  useEffect(() => {
    if (!voiceMode || !session) return;
    const t = setTimeout(() => {
      if (!voiceRecRef.current) {
        voiceRecRef.current = true;
        startRecording();
      }
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode, session]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [session?.messages?.length, thinking]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || !session || thinking) return;
    cancelAutoSend();
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
        title={t("triage.chat.title", { name: ASSISTANT_NAME })}
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
          <Text style={styles.unavailableTitle}>
            {t("triage.notAvailableTitle")}
          </Text>
          <Text style={styles.unavailableText}>{unavailable}</Text>
        </View>
      ) : !session ? (
        /* ── Setup: what do you need, and in which language? ── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.setup}
        >
          <Text style={styles.setupTitle}>
            {t("triage.setup.title", { name: ASSISTANT_NAME })}
          </Text>
          <Text style={styles.setupSub}>
            {t("triage.setup.subtitle", { name: ASSISTANT_NAME })}
          </Text>
          {[
            {
              m: "TRIAGE" as const,
              icon: "pulse" as const,
              title: t("triage.setup.triageTitle"),
              sub: t("triage.setup.triageSub"),
            },
            {
              m: "QA" as const,
              icon: "chatbubbles" as const,
              title: t("triage.setup.qaTitle"),
              sub: t("triage.setup.qaSub"),
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

          <Text style={styles.langLabel}>{t("triage.setup.language")}</Text>
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
              <Text style={styles.modeTitle}>
                {t("triage.setup.readAloud")}
              </Text>
              <Text style={styles.modeSub}>
                {t("triage.setup.readAloudSub", { name: ASSISTANT_NAME })}
              </Text>
            </View>
            <View
              style={[styles.autoPlayPill, autoPlay && styles.autoPlayPillOn]}
            >
              <Text
                style={[styles.autoPlayPillText, autoPlay && { color: "#fff" }]}
              >
                {autoPlay ? t("triage.on") : t("triage.off")}
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            haptic="medium"
            onPress={() => begin()}
            style={styles.startBtn}
          >
            {starting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.startText}>{t("triage.setup.start")}</Text>
              </>
            )}
          </AnimatedPressable>
          {quota ? (
            <Text style={styles.quotaLine}>
              {quota.unlimited
                ? t("triage.setup.quotaUnlimited")
                : t("triage.setup.quotaLeft", {
                    remaining: Math.max(0, quota.dailyLimit - quota.used[mode]),
                    limit: quota.dailyLimit,
                    unit:
                      mode === "QA"
                        ? t("triage.setup.unitQuestions")
                        : t("triage.setup.unitChecks"),
                  })}
            </Text>
          ) : null}
          <Text style={styles.disclaimer}>{t("triage.disclaimer")}</Text>
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
                  {t("triage.chat.thinking", { name: ASSISTANT_NAME })}
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
                  {t("triage.chat.talkToDoctor")}
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
                    {t("triage.verdict.suggested", {
                      specialty: verdict.specialty,
                    })}
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
                        <Text style={styles.ctaText}>
                          {t("triage.verdict.call112")}
                        </Text>
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
                            {t("triage.verdict.talkToDoctorToday")}
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
                      <Text style={styles.ctaText}>
                        {t("triage.verdict.startInstantConsult")}
                      </Text>
                    </AnimatedPressable>
                  ) : verdict.urgency === "SELF_CARE" ? (
                    <AnimatedPressable
                      haptic="light"
                      onPress={() => goToDoctors("BOOKED", verdict.specialty)}
                      style={[styles.cta, styles.ctaOutline]}
                    >
                      <Text style={[styles.ctaText, { color: colors.navy }]}>
                        {t("triage.verdict.bookAnyway")}
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
                        {verdict.specialty &&
                        verdict.specialty !== "General practice"
                          ? t("triage.verdict.bookSpecialty", {
                              specialty: verdict.specialty,
                            })
                          : t("triage.verdict.bookDoctor")}
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
                          {t("triage.verdict.programLabel", {
                            name: ASSISTANT_NAME,
                          })}
                        </Text>
                        <Text style={styles.programName}>
                          {verdict.programSuggestion.name}
                        </Text>
                        <Text style={styles.programSub}>
                          {t("triage.verdict.programSub", {
                            condition:
                              verdict.programSuggestion.condition.toLowerCase(),
                          })}
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
                    <Text style={styles.dismissText}>
                      {t("triage.verdict.close")}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {voiceError ? (
            <View style={styles.voiceErrBar}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={styles.voiceErrText}>{voiceError}</Text>
            </View>
          ) : autoSendIn != null ? (
            <AnimatedPressable
              haptic="light"
              onPress={cancelAutoSend}
              style={styles.autoSendBar}
            >
              <Ionicons name="send" size={13} color={colors.teal} />
              <Text style={styles.autoSendText}>
                {t("triage.voice.autoSend", { seconds: autoSendIn })}
              </Text>
            </AnimatedPressable>
          ) : null}

          {chatActive ? (
            recording ? (
              /* ── Recording bar ── */
              <View style={styles.inputRow}>
                <View style={styles.recBar}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>
                    {t("triage.voice.recording", {
                      seconds: String(recSeconds).padStart(2, "0"),
                    })}
                  </Text>
                  <Text style={styles.recHint}>
                    {voiceMode
                      ? t("triage.voice.hintAutoSend")
                      : t("triage.voice.hintMax")}
                  </Text>
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
                      ? t("triage.chat.transcribing")
                      : session.mode === "QA"
                        ? t("triage.chat.placeholderQa")
                        : t("triage.chat.placeholderTriage")
                  }
                  placeholderTextColor={colors.text.tertiary}
                  value={input}
                  onChangeText={(val) => {
                    setInput(val);
                    cancelAutoSend();
                  }}
                  onFocus={cancelAutoSend}
                  onSubmitEditing={() => send()}
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
                  onPress={() => send()}
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
          <Text style={styles.disclaimer}>{t("triage.disclaimer")}</Text>
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
    autoSendBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "center",
      backgroundColor: "rgba(44,183,167,0.10)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(44,183,167,0.35)",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.round,
      marginHorizontal: Space.xl,
      marginBottom: 2,
    },
    autoSendText: { fontFamily: Fonts.bold, fontSize: 12.5, color: c.tealDeep },
    voiceErrBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "center",
      backgroundColor: "rgba(240,103,92,0.10)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(240,103,92,0.40)",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.round,
      marginHorizontal: Space.xl,
      marginBottom: 2,
    },
    voiceErrText: {
      fontFamily: Fonts.bold,
      fontSize: 12,
      color: c.error,
      flexShrink: 1,
      textAlign: "center",
    },
    disclaimer: {
      ...Type.caption,
      fontSize: 10.5,
      color: c.text.tertiary,
      textAlign: "center",
      paddingVertical: 8,
    },
  });
