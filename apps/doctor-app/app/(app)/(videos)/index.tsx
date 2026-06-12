import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
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
import { Button } from "../../../src/components/common/Button";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AnimatedPressable, AppHeader, Txt } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

type VideoStatus = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";

interface VideoItem {
  id: string;
  title?: string;
  description: string;
  videoUrl: string;
  videoImage?: string;
  shareCount: number;
  source?: "UPLOAD" | "YOUTUBE";
  status?: VideoStatus;
  rejectionReason?: string | null;
  _count?: { likes: number; comments?: number };
}

const STATUS_META: Record<
  VideoStatus,
  {
    label: string;
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  PENDING: {
    label: "In review",
    color: "#B54708",
    bg: "rgba(247,144,9,0.14)",
    icon: "time-outline",
  },
  APPROVED: {
    label: "Live",
    color: "#067647",
    bg: "rgba(6,118,71,0.12)",
    icon: "checkmark-circle",
  },
  REJECTED: {
    label: "Rejected",
    color: "#B42318",
    bg: "rgba(217,45,32,0.12)",
    icon: "close-circle",
  },
  FLAGGED: {
    label: "Under review",
    color: "#B42318",
    bg: "rgba(217,45,32,0.12)",
    icon: "flag",
  },
};

export default function MyVideosScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    source: "UPLOAD" as "UPLOAD" | "YOUTUBE",
    isCommentAllowed: true,
  });
  const [loading, setLoading] = useState(false);

  const load = () => {
    doctorApi
      .getVideos()
      .then((r: unknown) => setVideos((r as { data: VideoItem[] }).data ?? []))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const handleUpload = async () => {
    if (!form.videoUrl.trim() || !form.title.trim()) return;
    setLoading(true);
    try {
      await doctorApi.uploadVideo(form as Record<string, unknown>);
      load();
      setShowUpload(false);
      setForm({
        title: "",
        description: "",
        videoUrl: "",
        source: "UPLOAD",
        isCommentAllowed: true,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await doctorApi.deleteVideo(id).catch(() => {});
    load();
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="My videos"
        right={
          <AnimatedPressable
            haptic="light"
            onPress={() => setShowUpload(true)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </AnimatedPressable>
        }
      />

      {videos.length === 0 ? (
        <EmptyState
          icon="videocam-outline"
          title="No videos yet"
          description="Share health tips and education with your patients."
          actionLabel="Upload a video"
          onAction={() => setShowUpload(true)}
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 14 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.videoCard}>
              {item.videoImage ? (
                <Image
                  source={{ uri: item.videoImage }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={Gradients.hero}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.thumb}
                >
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={20} color="#fff" />
                  </View>
                </LinearGradient>
              )}
              {item.source === "YOUTUBE" && (
                <View style={styles.ytBadge}>
                  <Ionicons name="logo-youtube" size={13} color="#FF0000" />
                </View>
              )}
              {item.status && (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_META[item.status].bg },
                  ]}
                >
                  <Ionicons
                    name={STATUS_META[item.status].icon}
                    size={11}
                    color={STATUS_META[item.status].color}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_META[item.status].color },
                    ]}
                  >
                    {STATUS_META[item.status].label}
                  </Text>
                </View>
              )}
              <AnimatedPressable
                haptic="medium"
                onPress={() => handleDelete(item.id)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={15} color="#fff" />
              </AnimatedPressable>
              <View style={styles.videoInfo}>
                <Text style={styles.videoDesc} numberOfLines={2}>
                  {item.title || item.description || "Untitled"}
                </Text>
                {item.status === "REJECTED" && item.rejectionReason ? (
                  <Text style={styles.rejectNote} numberOfLines={2}>
                    {item.rejectionReason}
                  </Text>
                ) : null}
                <View style={styles.videoStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="heart" size={13} color={colors.error} />
                    <Text style={styles.stat}>{item._count?.likes ?? 0}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons
                      name="arrow-redo"
                      size={13}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.stat}>{item.shareCount}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={showUpload}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUpload(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Txt variant="h2" style={{ marginBottom: 6 }}>
              Share a health clip
            </Txt>
            <Text style={styles.sheetHint}>
              Clips are reviewed before they appear in patients’ MediGram feed.
            </Text>

            <Text style={styles.fieldLabel}>Source</Text>
            <View style={styles.segment}>
              {(["UPLOAD", "YOUTUBE"] as const).map((s) => {
                const active = form.source === s;
                return (
                  <AnimatedPressable
                    key={s}
                    haptic="light"
                    onPress={() => setForm((f) => ({ ...f, source: s }))}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={
                        s === "YOUTUBE"
                          ? "logo-youtube"
                          : "cloud-upload-outline"
                      }
                      size={15}
                      color={active ? "#fff" : colors.text.secondary}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {s === "YOUTUBE" ? "YouTube link" : "Video URL"}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 3 signs of dehydration in kids"
              placeholderTextColor={colors.text.tertiary}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              maxLength={80}
            />
            <Text style={styles.fieldLabel}>
              {form.source === "YOUTUBE" ? "YouTube link" : "Video URL"}
            </Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={
                form.source === "YOUTUBE"
                  ? "https://youtube.com/watch?v=… or youtu.be/…"
                  : "https://…/clip.mp4"
              }
              placeholderTextColor={colors.text.tertiary}
              value={form.videoUrl}
              onChangeText={(v) => setForm((f) => ({ ...f, videoUrl: v }))}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, { height: 90 }]}
              placeholder="Describe your video…"
              placeholderTextColor={colors.text.tertiary}
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              multiline
            />
            <View style={styles.sheetBtns}>
              <Button
                label="Cancel"
                onPress={() => setShowUpload(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label="Submit for review"
                onPress={handleUpload}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
      ...Shadow.cta,
    },
    grid: {
      paddingHorizontal: Space.xl,
      paddingTop: 6,
      paddingBottom: 30,
      gap: 14,
    },
    videoCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: Radius.lg,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    thumb: {
      width: "100%",
      height: 110,
      alignItems: "center",
      justifyContent: "center",
    },
    playCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    deleteBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(8,18,32,0.55)",
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    ytBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "rgba(255,255,255,0.92)",
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    statusBadge: {
      position: "absolute",
      top: 78, // bottom-left of the 110-tall thumbnail
      left: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statusText: { fontFamily: Fonts.semibold, fontSize: 11 },
    rejectNote: {
      ...Type.caption,
      color: c.error,
      marginTop: 4,
      lineHeight: 15,
    },
    videoInfo: { padding: 12 },
    videoDesc: {
      ...Type.bodySm,
      fontFamily: Fonts.medium,
      color: c.text.primary,
      lineHeight: 17,
    },
    videoStats: { flexDirection: "row", gap: 14, marginTop: 8 },
    statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    stat: { ...Type.caption, color: c.text.tertiary },
    overlay: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      padding: Space.xxl,
      paddingBottom: 40,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginBottom: 18,
    },
    sheetHint: {
      ...Type.caption,
      color: c.text.tertiary,
      marginBottom: 18,
      lineHeight: 17,
    },
    segment: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    segmentBtnActive: { backgroundColor: c.teal, borderColor: c.teal },
    segmentText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: c.text.secondary,
    },
    segmentTextActive: { color: "#fff" },
    fieldLabel: { ...Type.label, color: c.text.secondary, marginBottom: 8 },
    fieldInput: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 14,
      ...Type.bodyMed,
      color: c.text.primary,
      marginBottom: 16,
      textAlignVertical: "top",
    },
    sheetBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  });
