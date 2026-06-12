import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  findNodeHandle,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable } from "../../../src/components/ui";
import {
  Gradients,
  Fonts,
  Palette,
  Radius,
  Shadow,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import {
  callApi,
  RecordingConsent,
  RecordingSession,
} from "../../../src/api/call.api";

// Zego ships native code — present only in a custom dev build, not Expo Go.
// Load defensively so the screen degrades to a UI preview everywhere else.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Zego: any = null;
try {
  Zego = require("zego-express-engine-reactnative");
} catch {
  /* not in this build */
}
const ZegoEngine = Zego?.default ?? null;
const ZegoTextureView = Zego?.ZegoTextureView ?? null;
const SCENARIO_VIDEO_CALL = Zego?.ZegoScenario?.StandardVideoCall ?? 4;
const VIEW_ASPECT_FILL = Zego?.ZegoViewMode?.AspectFill ?? 1;
const UPDATE_ADD = Zego?.ZegoUpdateType?.Add ?? 0;
// Only "available" when the NATIVE view manager is actually registered (a dev
// build) — the JS classes exist even in Expo Go, so checking them isn't enough.
const NATIVE_REGISTERED = !!(
  UIManager.getViewManagerConfig &&
  UIManager.getViewManagerConfig("RCTZegoTextureView")
);
const ZEGO_AVAILABLE = !!ZegoEngine && !!ZegoTextureView && NATIVE_REGISTERED;

type IoniconName = keyof typeof Ionicons.glyphMap;

function ControlButton({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: IoniconName;
  label?: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <AnimatedPressable
      haptic="medium"
      onPress={onPress}
      style={styles.ctrlWrap}
    >
      <View
        style={[
          styles.ctrl,
          active && styles.ctrlActive,
          danger && styles.ctrlDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={26}
          color={danger ? "#fff" : active ? colors.navy : "#fff"}
        />
      </View>
      {label ? <Text style={styles.ctrlLabel}>{label}</Text> : null}
    </AnimatedPressable>
  );
}

export default function VideoCallScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { appointmentId, topicId, doctorName } = useLocalSearchParams<{
    appointmentId?: string;
    topicId?: string;
    doctorName?: string;
  }>();
  const insets = useSafeAreaInsets();
  const roomId =
    (appointmentId ?? topicId ?? "doctium-room")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 100) || "doctium-room";

  const [status, setStatus] = useState<
    "connecting" | "live" | "preview" | "error"
  >(ZEGO_AVAILABLE ? "connecting" : "preview");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [front, setFront] = useState(true);
  const [recordingConsent, setRecordingConsent] =
    useState<RecordingConsent | null>(null);
  const [recordingSession, setRecordingSession] =
    useState<RecordingSession | null>(null);

  const localRef = useRef<View>(null);
  const remoteRef = useRef<View>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<any>(null);
  const recordingStartedRef = useRef(false);

  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;

    const applyConsent = (next: RecordingConsent) => {
      if (!cancelled) setRecordingConsent(next);
    };

    const loadConsent = async () => {
      try {
        const consent = await callApi.getRecordingConsent(appointmentId);
        applyConsent(consent);
        if (consent.status === "NOT_REQUESTED") {
          Alert.alert(
            "Record this consultation?",
            "Recording is optional. It will only be enabled if both you and your doctor consent.",
            [
              { text: "No recording", style: "cancel" },
              {
                text: "Request recording",
                onPress: async () => {
                  try {
                    applyConsent(
                      await callApi.requestRecordingConsent(appointmentId),
                    );
                  } catch {}
                },
              },
            ],
          );
        } else if (consent.status === "PENDING" && !consent.patientConsented) {
          Alert.alert(
            "Doctor requested recording",
            "You can decline and still continue the consultation. Recording needs consent from both parties.",
            [
              {
                text: "Decline",
                style: "destructive",
                onPress: async () => {
                  try {
                    applyConsent(
                      await callApi.respondRecordingConsent(
                        appointmentId,
                        false,
                      ),
                    );
                  } catch {}
                },
              },
              {
                text: "I consent",
                onPress: async () => {
                  try {
                    applyConsent(
                      await callApi.respondRecordingConsent(
                        appointmentId,
                        true,
                      ),
                    );
                  } catch {}
                },
              },
            ],
          );
        }
      } catch {
        // Consent is best-effort in Phase 1; never block the actual consultation.
      }
    };

    loadConsent();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  useEffect(() => {
    if (!ZEGO_AVAILABLE) return;
    let cancelled = false;

    (async () => {
      try {
        const { token, appId, userId } = await callApi.getToken();
        const engine = await ZegoEngine.createEngineWithProfile({
          appID: appId,
          scenario: SCENARIO_VIDEO_CALL,
        });
        engineRef.current = engine;

        engine.on(
          "roomStreamUpdate",
          async (
            _rid: string,
            type: number,
            streamList: { streamID: string }[],
          ) => {
            if (type === UPDATE_ADD && streamList?.length) {
              const remoteHandle = findNodeHandle(remoteRef.current);
              await engine.startPlayingStream(
                streamList[0]!.streamID,
                remoteHandle
                  ? {
                      reactTag: remoteHandle,
                      viewMode: VIEW_ASPECT_FILL,
                      backgroundColor: 0,
                    }
                  : undefined,
                undefined,
              );
              if (!cancelled) setRemoteJoined(true);
            } else if (!cancelled) {
              setRemoteJoined(false);
            }
          },
        );

        await engine.loginRoom(
          roomId,
          { userID: userId, userName: userId },
          { token, isUserStatusNotify: true },
        );

        const localHandle = findNodeHandle(localRef.current);
        await engine.startPreview(
          localHandle
            ? {
                reactTag: localHandle,
                viewMode: VIEW_ASPECT_FILL,
                backgroundColor: 0,
              }
            : undefined,
          undefined,
        );
        await engine.startPublishingStream(
          `${roomId}_${userId}`,
          undefined,
          undefined,
        );
        await engine.setAudioRouteToSpeaker(true);
        if (!cancelled) setStatus("live");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      const engine = engineRef.current;
      engineRef.current = null;
      (async () => {
        try {
          if (engine) {
            await engine.stopPublishingStream(undefined);
            await engine.stopPreview(undefined);
            await engine.logoutRoom(roomId);
            engine.off("roomStreamUpdate", undefined);
            await ZegoEngine.destroyEngine();
          }
        } catch {
          /* ignore teardown errors */
        }
      })();
    };
  }, [roomId]);

  useEffect(() => {
    if (
      !appointmentId ||
      recordingConsent?.status !== "CONSENTED" ||
      recordingStartedRef.current
    )
      return;
    let cancelled = false;
    recordingStartedRef.current = true;
    (async () => {
      try {
        const session = await callApi.startRecording(appointmentId);
        if (!cancelled) setRecordingSession(session);
      } catch {
        if (!cancelled) recordingStartedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, recordingConsent?.status]);

  // Call timer (starts once live)
  useEffect(() => {
    if (status !== "live" || !remoteJoined) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [status, remoteJoined]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const statusText =
    status === "preview"
      ? "Preview · full build needed"
      : status === "error"
        ? "Video unavailable"
        : status === "connecting"
          ? "Connecting…"
          : remoteJoined
            ? mmss
            : `Waiting for ${doctorName ?? "doctor"}…`;

  const recordingText = !appointmentId
    ? null
    : recordingSession?.status === "ACTIVE"
      ? "Recording active"
      : recordingSession?.status === "STARTING"
        ? "Recording starting"
        : recordingSession?.status === "FAILED"
          ? "Recording unavailable"
          : recordingConsent?.status === "CONSENTED"
            ? "Recording consented"
            : recordingConsent?.status === "PENDING"
              ? "Recording consent pending"
              : recordingConsent?.status === "DECLINED"
                ? "Recording declined"
                : "Recording off";

  const toggleMute = async () => {
    const n = !muted;
    setMuted(n);
    try {
      await engineRef.current?.muteMicrophone(n);
    } catch {}
  };
  const toggleVideo = async () => {
    const n = !videoOff;
    setVideoOff(n);
    try {
      await engineRef.current?.enableCamera(!n, undefined);
    } catch {}
  };
  const toggleSpeaker = async () => {
    const n = !speaker;
    setSpeaker(n);
    try {
      await engineRef.current?.setAudioRouteToSpeaker(n);
    } catch {}
  };
  const flip = async () => {
    const n = !front;
    setFront(n);
    try {
      await engineRef.current?.useFrontCamera(n, undefined);
    } catch {}
  };
  const endCall = async () => {
    if (appointmentId && recordingStartedRef.current) {
      try {
        setRecordingSession(await callApi.stopRecording(appointmentId));
      } catch {}
    }
    router.back();
  };

  const showRemoteVideo = ZEGO_AVAILABLE && remoteJoined;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Remote video (covers screen once the other party joins) */}
      {ZEGO_AVAILABLE ? (
        <ZegoTextureView
          ref={remoteRef as never}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Gradient + avatar — base layer / waiting state */}
      {!showRemoteVideo ? (
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.blobA} />
          <View style={styles.blobB} />
          <View style={[styles.remote, { paddingTop: insets.top + 60 }]}>
            <Avatar size={132} name={doctorName ?? "Doctor"} ring />
            <Text style={styles.name}>{doctorName ?? "Your doctor"}</Text>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={["rgba(8,18,32,0.55)", "transparent"]}
          style={styles.topScrim}
          pointerEvents="none"
        />
      )}

      {/* Status pill */}
      <View
        style={[
          styles.statusWrap,
          {
            top: insets.top + (showRemoteVideo ? 14 : 0),
            position: "absolute",
            alignSelf: "center",
          },
          !showRemoteVideo && { top: insets.top + 60 + 132 + 64 },
        ]}
      >
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  status === "live" && remoteJoined
                    ? colors.tealBright
                    : "#FBBF24",
              },
            ]}
          />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        {recordingText ? (
          <View style={styles.recordingPill}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
            <Text style={styles.recordingText}>{recordingText}</Text>
          </View>
        ) : null}
      </View>

      {/* Self view PiP */}
      <Animated.View
        entering={FadeIn.delay(400)}
        style={[styles.selfView, { top: insets.top + 12 }]}
      >
        {ZEGO_AVAILABLE && !videoOff ? (
          <ZegoTextureView
            ref={localRef as never}
            style={StyleSheet.absoluteFill}
          />
        ) : videoOff ? (
          <View style={styles.selfOff}>
            <Ionicons
              name="videocam-off"
              size={22}
              color="rgba(255,255,255,0.7)"
            />
          </View>
        ) : (
          <LinearGradient
            colors={Gradients.aurora}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.selfGrad}
          >
            <Ionicons name="person" size={28} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        )}
      </Animated.View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.ctrlRow}>
          <ControlButton
            icon={muted ? "mic-off" : "mic"}
            label="Mute"
            active={muted}
            onPress={toggleMute}
          />
          <ControlButton
            icon={videoOff ? "videocam-off" : "videocam"}
            label="Video"
            active={videoOff}
            onPress={toggleVideo}
          />
          <ControlButton
            icon={speaker ? "volume-high" : "volume-mute"}
            label="Speaker"
            active={!speaker}
            onPress={toggleSpeaker}
          />
          <ControlButton icon="camera-reverse" label="Flip" onPress={flip} />
        </View>
        <AnimatedPressable
          haptic="heavy"
          onPress={endCall}
          style={styles.endWrap}
        >
          <View style={styles.endBtn}>
            <Ionicons
              name="call"
              size={28}
              color="#fff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          </View>
          <Text style={styles.endLabel}>End call</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.navyDeep },
    topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
    blobA: {
      position: "absolute",
      top: 80,
      right: -60,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: "rgba(139,187,233,0.12)",
    },
    blobB: {
      position: "absolute",
      bottom: 160,
      left: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(139,187,233,0.12)",
    },
    remote: { flex: 1, alignItems: "center" },
    name: {
      fontFamily: Fonts.bold,
      fontSize: 22,
      color: "#fff",
      marginTop: 20,
      letterSpacing: -0.4,
    },
    statusWrap: { zIndex: 5 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "rgba(8,18,32,0.45)",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.round,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.18)",
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: "#fff",
      fontVariant: ["tabular-nums"],
    },
    recordingPill: {
      alignSelf: "center",
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(8,18,32,0.42)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.round,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.16)",
    },
    recordingText: {
      fontFamily: Fonts.medium,
      fontSize: 12,
      color: "rgba(255,255,255,0.9)",
    },
    selfView: {
      position: "absolute",
      right: 16,
      width: 100,
      height: 140,
      borderRadius: Radius.lg,
      overflow: "hidden",
      backgroundColor: c.navyDeep,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.25)",
      ...Shadow.floating,
      zIndex: 6,
    },
    selfGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
    selfOff: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11,23,38,0.7)",
    },
    controls: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingTop: 16,
      alignItems: "center",
      gap: 22,
      zIndex: 6,
    },
    ctrlRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignSelf: "stretch",
    },
    ctrlWrap: { alignItems: "center", gap: 7 },
    ctrl: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.2)",
    },
    ctrlActive: { backgroundColor: "#fff" },
    ctrlDanger: { backgroundColor: c.error },
    ctrlLabel: {
      fontFamily: Fonts.medium,
      fontSize: 12,
      color: "rgba(255,255,255,0.85)",
    },
    endWrap: { alignItems: "center", gap: 8 },
    endBtn: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: c.error,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.floating,
    },
    endLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: "rgba(255,255,255,0.9)",
    },
  });
