import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../../../src/components/common/Avatar";
import { AnimatedPressable } from "../../../src/components/ui";
import {
  Fonts,
  Gradients,
  Palette,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { videosApi } from "../../../src/api/videos.api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CommentItem {
  id: string;
  comment: string;
  createdAt?: string;
  user?: { name?: string; image?: string };
}

interface VideoItem {
  id: string;
  videoUrl: string;
  title?: string;
  description: string;
  shareCount: number;
  source?: "UPLOAD" | "YOUTUBE";
  likedByMe?: boolean;
  isCommentAllowed?: boolean;
  doctor: { id?: string; name: string; designation: string; image?: string };
  _count?: { likes: number; comments?: number };
}

const REPORT_REASONS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "MISINFORMATION",
    label: "Medical misinformation",
    icon: "alert-circle-outline",
  },
  {
    key: "HARMFUL_ADVICE",
    label: "Harmful or dangerous advice",
    icon: "warning-outline",
  },
  { key: "SPAM", label: "Spam or misleading", icon: "ban-outline" },
  {
    key: "SEXUAL_CONTENT",
    label: "Sexual or inappropriate",
    icon: "eye-off-outline",
  },
  { key: "HARASSMENT", label: "Harassment or hate", icon: "hand-left-outline" },
  {
    key: "COPYRIGHT",
    label: "Copyright (not their content)",
    icon: "document-lock-outline",
  },
  {
    key: "OTHER",
    label: "Something else",
    icon: "ellipsis-horizontal-circle-outline",
  },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1]! : null;
}

/** YouTube clips play through an embedded iframe; only mounted while active so swiping away stops playback. */
function YouTubeLayer({ url, isActive }: { url: string; isActive: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const [failed, setFailed] = useState(false);
  const id = youtubeId(url);
  if (!id)
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
    );
  if (!isActive) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.ytPoster]}>
        <Image
          source={{ uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }}
          style={StyleSheet.absoluteFill}
          blurRadius={2}
        />
        <View style={styles.ytPlayBadge}>
          <Ionicons name="logo-youtube" size={26} color="#fff" />
        </View>
      </View>
    );
  }
  // Some videos error in a raw <iframe> (e.g. 152 — referrer/embed-context), and
  // a few owners disable embedding outright (101/150). When the player reports an
  // unrecoverable error, fall back to opening the clip in the YouTube app/site.
  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.ytPoster]}>
        <Image
          source={{ uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }}
          style={StyleSheet.absoluteFill}
          blurRadius={4}
        />
        <View style={styles.ytFallback}>
          <Ionicons name="logo-youtube" size={42} color="#fff" />
          <Text style={styles.ytFallbackText}>
            This video can&apos;t play here
          </Text>
          <Pressable
            onPress={() =>
              Linking.openURL(`https://www.youtube.com/watch?v=${id}`)
            }
            style={styles.ytFallbackBtn}
          >
            <Ionicons name="logo-youtube" size={16} color="#fff" />
            <Text style={styles.ytFallbackBtnText}>Watch on YouTube</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  // Use the YouTube IFrame Player API (not a static <iframe>): with a real
  // document origin (baseUrl) plus matching `origin`/`widget_referrer` player
  // vars, the player gets the embed context it needs — this clears origin/
  // referrer errors (153/152) and lets autoplay fire. onError surfaces the
  // remaining owner-disabled cases so we can show the fallback above.
  const ORIGIN = "https://www.youtube.com";
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>*{margin:0;padding:0}html,body{height:100%;background:#000;overflow:hidden}#player{width:100%;height:100%}</style></head><body><div id="player"></div><script>function post(m){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);}var t=document.createElement('script');t.src='https://www.youtube.com/iframe_api';document.body.appendChild(t);function onYouTubeIframeAPIReady(){new YT.Player('player',{width:'100%',height:'100%',videoId:'${id}',playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1,controls:1,fs:0,origin:'${ORIGIN}',widget_referrer:'${ORIGIN}'},events:{onReady:function(e){try{e.target.playVideo();}catch(_){}},onError:function(e){post('error:'+e.data);}}});}</script></body></html>`;
  return (
    <WebView
      source={{ html, baseUrl: ORIGIN }}
      style={StyleSheet.absoluteFill}
      originWhitelist={["*"]}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      androidLayerType="hardware"
      onMessage={(e) => {
        if (e.nativeEvent.data?.startsWith("error:")) setFailed(true);
      }}
    />
  );
}

/* ── Right-rail action button — frosted disc with a spring pop ───────────── */
function Action({
  icon,
  label,
  onPress,
  color = "#fff",
  fill,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress?: () => void;
  color?: string;
  fill?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const pop = () => {
    scale.value = withSequence(
      withTiming(0.82, { duration: 90 }),
      withSpring(1, { damping: 9, stiffness: 320 }),
    );
    onPress?.();
  };
  return (
    <Pressable onPress={pop} style={styles.action} hitSlop={6}>
      <Animated.View
        style={[styles.actionDisc, fill && styles.actionDiscFill, style]}
      >
        <Ionicons name={icon} size={25} color={color} />
      </Animated.View>
      {label !== undefined && <Text style={styles.actionLabel}>{label}</Text>}
    </Pressable>
  );
}

/* ── A single full-screen clip ──────────────────────────────────────────── */
function ClipPlayer({
  item,
  isActive,
  onOpenComments,
  onCommentCount,
}: {
  item: VideoItem;
  isActive: boolean;
  onOpenComments: (v: VideoItem, setCount: (n: number) => void) => void;
  onCommentCount?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isYoutube = item.source === "YOUTUBE";
  // YouTube clips render in a WebView; keep the native player idle (null source).
  const player = useVideoPlayer(isYoutube ? null : item.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  const [liked, setLiked] = useState(!!item.likedByMe);
  const [likeCount, setLikeCount] = useState(item._count?.likes ?? 0);
  const [shareCount, setShareCount] = useState(item.shareCount ?? 0);
  const [commentCount, setCommentCount] = useState(item._count?.comments ?? 0);
  const [paused, setPaused] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);

  // Playback progress for the signature teal hairline.
  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Double-tap heart burst.
  const burst = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.6 + burst.value * 0.7 }],
  }));
  const playIconOpacity = useSharedValue(0);
  const playIconStyle = useAnimatedStyle(() => ({
    opacity: playIconOpacity.value,
  }));

  useEffect(() => {
    if (isYoutube) return;
    if (isActive) {
      player.play();
      setPaused(false);
    } else {
      player.pause();
    }
  }, [isActive, player, isYoutube]);

  useEffect(() => {
    if (!isActive || isYoutube) return;
    const t = setInterval(() => {
      const d = player.duration || 0;
      progress.value = d > 0 ? Math.min(player.currentTime / d, 1) : 0;
    }, 250);
    return () => clearInterval(t);
  }, [isActive, player, isYoutube]);

  const submitReport = useCallback(
    async (reason: string) => {
      setReportOpen(false);
      setReported(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      try {
        await videosApi.report(item.id, reason);
      } catch {
        setReported(false);
      }
    },
    [item.id],
  );

  const doLike = useCallback(
    async (force?: boolean) => {
      const next = force ?? !liked;
      if (next === liked) return;
      setLiked(next);
      setLikeCount((c) => c + (next ? 1 : -1));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      try {
        await videosApi.toggleLike(item.id);
      } catch {
        setLiked((l) => !l);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    },
    [liked, item.id],
  );

  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      // double-tap → like + burst
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = 0;
      burst.value = withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0, { duration: 420 }),
      );
      doLike(true);
    } else {
      lastTap.current = now;
      singleTapTimer.current = setTimeout(() => {
        // single-tap → toggle play/pause with an icon flash
        if (player.playing) {
          player.pause();
          setPaused(true);
        } else {
          player.play();
          setPaused(false);
        }
        playIconOpacity.value = withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 500 }),
        );
      }, 260);
    }
  };

  const onShare = async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await Share.share({
        message: `${item.title || "A health tip"} — by Dr. ${item.doctor.name} on Doctium MediGram`,
      });
      setShareCount((c) => c + 1);
      videosApi.share(item.id).catch(() => {});
    } catch {}
  };

  return (
    <View style={styles.clip}>
      {isYoutube ? (
        <YouTubeLayer url={item.videoUrl} isActive={isActive} />
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        </Pressable>
      )}

      <LinearGradient
        colors={Gradients.scrim}
        style={styles.scrim}
        pointerEvents="none"
      />

      {/* Report (kebab) — top-right, below the brand header */}
      <AnimatedPressable
        haptic="light"
        onPress={() => setReportOpen(true)}
        style={[styles.kebab, { top: insets.top + 64 }]}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={18}
          color="rgba(255,255,255,0.9)"
        />
      </AnimatedPressable>

      {/* Center play/pause flash + double-tap heart burst (native only) */}
      {!isYoutube && (
        <View style={styles.centerFx} pointerEvents="none">
          <Animated.View style={playIconStyle}>
            <View style={styles.playFlash}>
              <Ionicons
                name={paused ? "play" : "pause"}
                size={34}
                color="#fff"
              />
            </View>
          </Animated.View>
          <Animated.View style={[styles.heartBurst, burstStyle]}>
            <Ionicons name="heart" size={120} color="#FF4D6D" />
          </Animated.View>
        </View>
      )}

      <View style={[styles.overlay, { paddingBottom: insets.bottom + 92 }]}>
        {/* Bottom-left credential card: avatar + name + title */}
        <View style={styles.docInfo}>
          <BlurView intensity={26} tint="dark" style={styles.credCard}>
            <Avatar
              uri={item.doctor.image}
              name={item.doctor.name}
              size={38}
              ring
            />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.docName} numberOfLines={1}>
                  Dr. {item.doctor.name}
                </Text>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.teal}
                />
              </View>
              <Text style={styles.docSpec} numberOfLines={1}>
                {item.doctor.designation}
              </Text>
            </View>
          </BlurView>

          {!!item.title && (
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
          )}
          {!!item.description && (
            <Text style={styles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Health disclaimer — educational content, not a diagnosis */}
          <View style={styles.disclaimer}>
            <Ionicons
              name="information-circle-outline"
              size={12}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={styles.disclaimerText} numberOfLines={1}>
              Educational only — not a diagnosis. See a doctor for advice.
            </Text>
          </View>
        </View>

        {/* Right rail */}
        <View style={styles.actions}>
          <Action
            icon={liked ? "heart" : "heart-outline"}
            color={liked ? "#FF4D6D" : "#fff"}
            label={fmt(likeCount)}
            onPress={() => doLike()}
          />
          <Action
            icon="chatbubble-ellipses"
            label={fmt(onCommentCount ?? commentCount)}
            onPress={() => onOpenComments(item, setCommentCount)}
          />
          <Action icon="arrow-redo" label={fmt(shareCount)} onPress={onShare} />
        </View>
      </View>

      {/* Signature teal playback hairline (native clips only) */}
      {!isYoutube && (
        <View
          style={[styles.progressTrack, { bottom: insets.bottom + 78 }]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}

      <ReportSheet
        visible={reportOpen}
        reported={reported}
        onClose={() => setReportOpen(false)}
        onSubmit={submitReport}
      />
    </View>
  );
}

/* ── Report reasons sheet ───────────────────────────────────────────────── */
function ReportSheet({
  visible,
  reported,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  reported: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View
        style={[styles.reportSheetWrap, { paddingBottom: insets.bottom + 12 }]}
      >
        <BlurView intensity={60} tint="dark" style={styles.reportSheet}>
          <View style={styles.sheetHandle} />
          {reported ? (
            <View style={styles.reportDone}>
              <Ionicons name="checkmark-circle" size={40} color={colors.teal} />
              <Text style={styles.reportDoneText}>
                Thanks — our team will review this clip.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sheetTitle}>Report this clip</Text>
              <Text style={styles.reportHint}>
                Why are you reporting it? Doctium’s team will review it.
              </Text>
              {REPORT_REASONS.map((r) => (
                <AnimatedPressable
                  key={r.key}
                  haptic="light"
                  onPress={() => onSubmit(r.key)}
                  style={styles.reportRow}
                >
                  <Ionicons
                    name={r.icon}
                    size={19}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.reportLabel}>{r.label}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="rgba(255,255,255,0.35)"
                  />
                </AnimatedPressable>
              ))}
            </>
          )}
        </BlurView>
      </View>
    </Modal>
  );
}

/* ── Frosted comments sheet ─────────────────────────────────────────────── */
function CommentsSheet({
  video,
  onClose,
  onAdded,
}: {
  video: VideoItem | null;
  onClose: () => void;
  onAdded: (n: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!video) return;
    setComments([]);
    setLoading(true);
    videosApi
      .getOne(video.id)
      .then((r: unknown) => {
        const data = (
          r as {
            data: { comments?: CommentItem[]; _count?: { comments?: number } };
          }
        ).data;
        setComments(data.comments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [video?.id]);

  const send = async () => {
    const body = text.trim();
    if (!body || !video || sending) return;
    setSending(true);
    setText("");
    try {
      const r = await videosApi.addComment(video.id, body);
      const created = (r as { data: CommentItem }).data;
      setComments((c) => [created, ...c]);
      onAdded(comments.length + 1);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={!!video}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <BlurView intensity={60} tint="dark" style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {comments.length > 0
              ? `${fmt(comments.length)} comments`
              : "Comments"}
          </Text>

          {loading ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator color={colors.teal} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.sheetEmpty}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={34}
                color="rgba(255,255,255,0.4)"
              />
              <Text style={styles.sheetEmptyText}>Be the first to comment</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: c }) => (
                <View style={styles.commentRow}>
                  <Avatar
                    uri={c.user?.image}
                    name={c.user?.name ?? "U"}
                    size={34}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentName}>
                      {c.user?.name ?? "Patient"}
                    </Text>
                    <Text style={styles.commentBody}>{c.comment}</Text>
                  </View>
                </View>
              )}
            />
          )}

          {video?.isCommentAllowed === false ? (
            <View
              style={[
                styles.commentDisabled,
                { paddingBottom: insets.bottom + 10 },
              ]}
            >
              <Ionicons
                name="lock-closed"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.commentDisabledText}>
                Comments are turned off for this clip
              </Text>
            </View>
          ) : (
            <View
              style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}
            >
              <TextInput
                style={styles.composerInput}
                placeholder="Add a comment…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={text}
                onChangeText={setText}
                multiline
              />
              <AnimatedPressable
                haptic="light"
                onPress={send}
                style={styles.sendBtn}
                disabled={!text.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                )}
              </AnimatedPressable>
            </View>
          )}
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MediGramScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sheetVideo, setSheetVideo] = useState<VideoItem | null>(null);
  const setCountRef = useRef<((n: number) => void) | null>(null);
  const [, setLiveCommentCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    videosApi
      .getAll()
      .then((r: unknown) => setVideos((r as { data: VideoItem[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0]!.index !== null) {
        setActiveIndex(viewableItems[0]!.index);
      }
    },
    [],
  );

  const openComments = useCallback(
    (v: VideoItem, setCount: (n: number) => void) => {
      setCountRef.current = setCount;
      setLiveCommentCount(v._count?.comments ?? 0);
      setSheetVideo(v);
    },
    [],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Top header overlay */}
      <View
        style={[styles.header, { paddingTop: insets.top + 10 }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.brandRow}>
          <Ionicons name="medical" size={20} color={colors.teal} />
          <Text style={styles.brand}>MediGram</Text>
        </View>
        <Text style={styles.subtitle}>
          Health education from verified doctors
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.teal} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="film-outline"
            size={48}
            color="rgba(255,255,255,0.5)"
          />
          <Text style={styles.emptyText}>No clips yet. Check back soon.</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          windowSize={3}
          maxToRenderPerBatch={3}
          removeClippedSubviews
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          renderItem={({ item, index }) => (
            <ClipPlayer
              item={item}
              isActive={index === activeIndex}
              onOpenComments={openComments}
            />
          )}
        />
      )}

      <CommentsSheet
        video={sheetVideo}
        onClose={() => setSheetVideo(null)}
        onAdded={(n) => {
          setLiveCommentCount(n);
          setCountRef.current?.(n);
        }}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    header: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingHorizontal: 18,
      paddingBottom: 22,
    },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    brand: {
      fontFamily: Fonts.extrabold,
      fontSize: 23,
      color: "#fff",
      letterSpacing: -0.6,
    },
    subtitle: {
      fontFamily: Fonts.medium,
      fontSize: 12.5,
      color: "rgba(255,255,255,0.78)",
      marginTop: 2,
    },

    clip: { height: SCREEN_HEIGHT, backgroundColor: "#0A0A0A" },
    scrim: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "58%",
    },

    centerFx: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    playFlash: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: "rgba(10,18,32,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    heartBurst: { position: "absolute" },

    overlay: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
    },
    docInfo: { flex: 1, paddingRight: 12, gap: 9 },
    credCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      alignSelf: "flex-start",
      paddingVertical: 7,
      paddingHorizontal: 9,
      paddingRight: 16,
      borderRadius: 30,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.18)",
      maxWidth: "92%",
    },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    docName: {
      fontFamily: Fonts.bold,
      fontSize: 15,
      color: "#fff",
      letterSpacing: -0.2,
      flexShrink: 1,
    },
    docSpec: {
      fontFamily: Fonts.medium,
      fontSize: 11.5,
      color: "rgba(255,255,255,0.82)",
      marginTop: 1,
    },
    title: {
      fontFamily: Fonts.bold,
      fontSize: 17,
      color: "#fff",
      letterSpacing: -0.3,
      lineHeight: 22,
    },
    desc: {
      fontFamily: Fonts.regular,
      fontSize: 13.5,
      color: "rgba(255,255,255,0.9)",
      lineHeight: 19,
    },
    disclaimer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    disclaimerText: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: 10.5,
      color: "rgba(255,255,255,0.7)",
      letterSpacing: 0.1,
    },

    actions: { gap: 20, alignItems: "center" },
    action: { alignItems: "center", gap: 5 },
    actionDisc: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: "rgba(255,255,255,0.13)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.2)",
    },
    actionDiscFill: {},
    actionLabel: { fontFamily: Fonts.semibold, fontSize: 12, color: "#fff" },

    progressTrack: {
      position: "absolute",
      left: 16,
      right: 16,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.18)",
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 2, overflow: "hidden" },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
    emptyText: {
      fontFamily: Fonts.medium,
      color: "rgba(255,255,255,0.6)",
      fontSize: 15,
    },

    /* Comments sheet */
    sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheetWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "68%",
    },
    sheet: {
      flex: 1,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      overflow: "hidden",
      paddingHorizontal: 18,
      paddingTop: 10,
      backgroundColor: "rgba(14,22,36,0.72)",
    },
    sheetHandle: {
      alignSelf: "center",
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.3)",
      marginBottom: 12,
    },
    sheetTitle: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: "#fff",
      marginBottom: 14,
      letterSpacing: -0.2,
    },
    sheetLoading: { paddingVertical: 40, alignItems: "center" },
    sheetEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    sheetEmptyText: {
      fontFamily: Fonts.medium,
      fontSize: 14,
      color: "rgba(255,255,255,0.55)",
    },
    commentRow: {
      flexDirection: "row",
      gap: 11,
      marginBottom: 16,
      alignItems: "flex-start",
    },
    commentName: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: "rgba(255,255,255,0.92)",
      marginBottom: 2,
    },
    commentBody: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: "#fff",
      lineHeight: 19,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.14)",
    },
    composerInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      fontFamily: Fonts.regular,
      fontSize: 14.5,
      color: "#fff",
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
    },
    commentDisabled: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.14)",
    },
    commentDisabledText: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      color: "rgba(255,255,255,0.5)",
    },

    /* Report */
    kebab: {
      position: "absolute",
      right: 14,
      zIndex: 12,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.2)",
    },
    ytPoster: {
      backgroundColor: "#000",
      alignItems: "center",
      justifyContent: "center",
    },
    ytPlayBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    ytFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingHorizontal: 32,
    },
    ytFallbackText: {
      fontSize: 15,
      color: "#fff",
      fontFamily: Fonts.semibold,
      textAlign: "center",
    },
    ytFallbackBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "#FF0000",
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 24,
    },
    ytFallbackBtnText: {
      fontSize: 15,
      color: "#fff",
      fontFamily: Fonts.bold,
    },
    reportSheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
    reportSheet: {
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      overflow: "hidden",
      paddingHorizontal: 18,
      paddingTop: 10,
      backgroundColor: "rgba(14,22,36,0.82)",
    },
    reportHint: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: "rgba(255,255,255,0.6)",
      marginBottom: 14,
      marginTop: -6,
    },
    reportRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.08)",
    },
    reportLabel: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: 15,
      color: "#fff",
    },
    reportDone: { alignItems: "center", gap: 12, paddingVertical: 34 },
    reportDoneText: {
      fontFamily: Fonts.medium,
      fontSize: 15,
      color: "rgba(255,255,255,0.9)",
      textAlign: "center",
      paddingHorizontal: 20,
    },
  });
