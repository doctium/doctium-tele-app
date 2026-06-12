import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { Badge } from "../../../src/components/common/Badge";
import { Button } from "../../../src/components/common/Button";
import { AppHeader, Card, Txt } from "../../../src/components/ui";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchAppointment } from "../../../src/store/slices/appointmentsSlice";
import { appointmentsApi } from "../../../src/api/appointments.api";
import {
  callApi,
  RecordingAsset,
  RecordingRequest,
} from "../../../src/api/call.api";
import { subscriptionApi } from "../../../src/api/subscription.api";
import { formatMoney } from "../../../src/utils/money";

const statusMap: Record<
  string,
  "pending" | "confirmed" | "completed" | "cancelled"
> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export default function AppointmentDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { selected } = useAppSelector((s) => s.appointments);
  const [cancelling, setCancelling] = useState(false);
  const [recordings, setRecordings] = useState<RecordingAsset[]>([]);
  const [recordingRequests, setRecordingRequests] = useState<
    RecordingRequest[]
  >([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingPlayback, setRecordingPlayback] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackTitle, setPlaybackTitle] = useState("Consultation replay");

  useEffect(() => {
    if (id) dispatch(fetchAppointment(id));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setRecordingsLoading(true);
    callApi
      .listRecordingAssets(id)
      .then(setRecordings)
      .catch(() => setRecordings([]))
      .finally(() => setRecordingsLoading(false));
    callApi
      .listRecordingRequests(id)
      .then(setRecordingRequests)
      .catch(() => setRecordingRequests([]));

    subscriptionApi
      .getMine()
      .then((r: unknown) => {
        const entitlements = (
          r as { data?: { entitlements?: { recordingPlayback?: boolean } } }
        ).data?.entitlements;
        setRecordingPlayback(!!entitlements?.recordingPlayback);
      })
      .catch(() => setRecordingPlayback(false));
  }, [id]);

  const a = selected as {
    id: string;
    appointmentId: string;
    date: string;
    time: string;
    status: string;
    type: string;
    amount: number;
    couponCode?: string;
    discount?: number;
    isReviewed?: boolean;
    doctor?: {
      id?: string;
      name: string;
      image?: string;
      designation?: string;
    };
    service?: { name: string };
    subPatient?: { name: string; relation: string; age?: number };
  } | null;

  const handleCancel = () => {
    Alert.alert(
      "Cancel appointment",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await appointmentsApi.cancel(id, "Patient cancelled");
              dispatch(fetchAppointment(id));
            } catch {}
            setCancelling(false);
          },
        },
      ],
    );
  };

  const openRecording = async (asset: RecordingAsset) => {
    if (!recordingPlayback) {
      Alert.alert(
        "Upgrade required",
        "Consultation playback is available on DoctiumPlus plans that include secure recording replay.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "View plans",
            onPress: () => router.push("/(app)/(subscription)"),
          },
        ],
      );
      return;
    }
    try {
      setPlaybackTitle(asset.fileName || "Consultation replay");
      const access = await callApi.getRecordingAssetAccess(id, asset.id);
      setPlaybackUrl(access.accessUrl);
    } catch {
      Alert.alert(
        "Playback unavailable",
        "The secure playback link could not be created. Please try again later.",
      );
    }
  };

  const createRecordingRequest = async (
    type: "EXPORT" | "DELETE",
    asset?: RecordingAsset,
  ) => {
    try {
      const request = await callApi.createRecordingRequest(id, {
        type,
        assetId: asset?.id,
        reason:
          type === "EXPORT"
            ? "Patient requested consultation recording export"
            : "Patient requested consultation recording deletion",
      });
      setRecordingRequests((prev) => [request, ...prev]);
      Alert.alert(
        type === "EXPORT" ? "Export requested" : "Deletion requested",
        type === "EXPORT"
          ? "Your export request has been sent for review."
          : "Your deletion request has been sent for review. Deletion may be paused if a dispute hold applies.",
      );
    } catch {
      Alert.alert(
        "Request unavailable",
        "Could not create this recording request. Please try again later.",
      );
    }
  };

  if (!a) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title="Appointment" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.docRow}>
            <Avatar
              uri={a.doctor?.image}
              name={a.doctor?.name}
              size={58}
              ring
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>{a.doctor?.name}</Text>
              <Text style={styles.docSpec}>
                {a.doctor?.designation ?? a.service?.name}
              </Text>
            </View>
            <Badge variant={statusMap[a.status] ?? "info"} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            Details
          </Txt>
          <InfoRow
            icon="pricetag-outline"
            label="Reference"
            value={`#${a.appointmentId.slice(-8).toUpperCase()}`}
          />
          <InfoRow icon="calendar-outline" label="Date" value={a.date} />
          <InfoRow icon="time-outline" label="Time" value={a.time} />
          <InfoRow
            icon={a.type === "ONLINE" ? "videocam-outline" : "business-outline"}
            label="Type"
            value={a.type === "ONLINE" ? "Video call" : "Clinic visit"}
            last
          />
        </Card>

        {a.subPatient ? (
          <Card style={styles.card}>
            <Txt variant="h3" style={styles.cardTitle}>
              Patient
            </Txt>
            <InfoRow
              icon="person-outline"
              label="Name"
              value={a.subPatient.name}
            />
            <InfoRow
              icon="people-outline"
              label="Relation"
              value={a.subPatient.relation}
              last={!a.subPatient.age}
            />
            {a.subPatient.age ? (
              <InfoRow
                icon="hourglass-outline"
                label="Age"
                value={`${a.subPatient.age} years`}
                last
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            Payment
          </Txt>
          <InfoRow
            icon="card-outline"
            label="Consultation fee"
            value={formatMoney(a.amount)}
            last={!(a.discount ?? 0) && !a.couponCode}
          />
          {(a.discount ?? 0) > 0 ? (
            <InfoRow
              icon="pricetags-outline"
              label="Discount"
              value={`âˆ’${formatMoney(a.discount ?? 0)}`}
              last={!a.couponCode}
            />
          ) : null}
          {a.couponCode ? (
            <InfoRow
              icon="ticket-outline"
              label="Coupon"
              value={a.couponCode}
              last
            />
          ) : null}
        </Card>

        <RecordingCard
          assets={recordings}
          requests={recordingRequests}
          loading={recordingsLoading}
          playbackEnabled={recordingPlayback}
          onOpen={openRecording}
          onUpgrade={() => router.push("/(app)/(subscription)")}
          onRequest={createRecordingRequest}
        />

        {a.status === "CONFIRMED" ? (
          <View style={{ gap: 12, marginTop: 4 }}>
            {a.type === "ONLINE" ? (
              <Button
                label="Join video call"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(chat)/call",
                    params: { appointmentId: a.id },
                  })
                }
                icon={<Ionicons name="videocam" size={18} color="#fff" />}
              />
            ) : null}
            <Button
              label="Cancel appointment"
              onPress={handleCancel}
              loading={cancelling}
              variant="outline"
            />
          </View>
        ) : null}
        {a.status === "COMPLETED" && !a.isReviewed ? (
          <Button
            label="Leave a review"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/(app)/(appointments)/review",
                params: { appointmentId: a.id, doctorId: a.doctor?.id ?? "" },
              })
            }
            icon={<Ionicons name="star" size={17} color="#fff" />}
            style={{ marginTop: 4 }}
          />
        ) : null}
      </ScrollView>
      <RecordingPlayer
        title={playbackTitle}
        url={playbackUrl}
        onClose={() => setPlaybackUrl(null)}
      />
    </View>
  );
}

function RecordingCard({
  assets,
  requests,
  loading,
  playbackEnabled,
  onOpen,
  onUpgrade,
  onRequest,
}: {
  assets: RecordingAsset[];
  requests: RecordingRequest[];
  loading: boolean;
  playbackEnabled: boolean;
  onOpen: (asset: RecordingAsset) => void;
  onUpgrade: () => void;
  onRequest: (type: "EXPORT" | "DELETE", asset?: RecordingAsset) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.replayHeader}>
          <Txt variant="h3" style={styles.cardTitle}>
            Consultation replay
          </Txt>
          <ActivityIndicator color={colors.teal} />
        </View>
      </Card>
    );
  }
  if (assets.length === 0) return null;
  const latestRequest = requests[0] ?? null;
  return (
    <Card style={styles.card}>
      <View style={styles.replayHeader}>
        <Txt variant="h3" style={styles.cardTitle}>
          Consultation replay
        </Txt>
        <View style={styles.securePill}>
          <Ionicons
            name={playbackEnabled ? "lock-closed" : "star"}
            size={12}
            color={colors.tealDeep}
          />
          <Text style={styles.secureText}>
            {playbackEnabled ? "Secure" : "Premium"}
          </Text>
        </View>
      </View>
      {!playbackEnabled ? (
        <Pressable onPress={onUpgrade} style={styles.lockedReplay}>
          <Ionicons name="lock-closed" size={16} color={colors.tealDeep} />
          <Text style={styles.lockedText}>
            Upgrade to replay this consultation securely.
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.text.tertiary}
          />
        </Pressable>
      ) : null}
      {latestRequest ? (
        <Text style={styles.requestSummary}>
          Latest request: {latestRequest.type.toLowerCase()} is{" "}
          {latestRequest.status.toLowerCase()}
        </Text>
      ) : null}
      {assets.map((asset, index) => (
        <Pressable
          key={asset.id}
          onPress={() => onOpen(asset)}
          style={[
            styles.replayRow,
            index < assets.length - 1 && styles.infoRowBorder,
          ]}
        >
          <View style={styles.replayIcon}>
            <Ionicons
              name={playbackEnabled ? "play" : "lock-closed"}
              size={18}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.replayTitle}>
              {asset.fileName || "Consultation recording"}
            </Text>
            <Text style={styles.replayMeta}>
              {[
                asset.durationSeconds
                  ? `${Math.round(asset.durationSeconds / 60)} min`
                  : null,
                asset.encrypted ? "Encrypted" : null,
              ]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          </View>
          <Ionicons
            name={playbackEnabled ? "chevron-forward" : "star-outline"}
            size={18}
            color={colors.text.tertiary}
          />
        </Pressable>
      ))}
      <View style={styles.requestActions}>
        <Pressable
          onPress={() => onRequest("EXPORT", assets[0])}
          style={styles.requestBtn}
        >
          <Ionicons name="download-outline" size={15} color={colors.tealDeep} />
          <Text style={styles.requestBtnText}>Request export</Text>
        </Pressable>
        <Pressable
          onPress={() => onRequest("DELETE", assets[0])}
          style={styles.requestBtnDanger}
        >
          <Ionicons name="trash-outline" size={15} color="#B42318" />
          <Text style={styles.requestBtnDangerText}>Request deletion</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function RecordingPlayer({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  if (!url) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.playerBackdrop}>
        <View style={styles.playerSheet}>
          <View style={styles.playerHeader}>
            <Text style={styles.playerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text.primary} />
            </Pressable>
          </View>
          <VideoView
            player={player}
            style={styles.videoPlayer}
            allowsFullscreen
            allowsPictureInPicture
          />
          <Text style={styles.playerHint}>
            This secure playback link expires automatically.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={17} color={colors.text.tertiary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    card: { marginBottom: 14 },
    cardTitle: { marginBottom: 6 },
    docRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    docName: { ...Type.h3, color: c.text.primary },
    docSpec: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      gap: 16,
    },
    infoRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    infoLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
    infoLabel: { ...Type.body, color: c.text.secondary },
    infoValue: {
      ...Type.bodyMed,
      color: c.text.primary,
      maxWidth: "55%",
      textAlign: "right",
    },
    replayHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    securePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.tealSoft,
      borderRadius: Radius.round,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    secureText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
    },
    lockedReplay: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      backgroundColor: c.tealSoft,
      borderRadius: Radius.md,
      padding: 12,
      marginTop: 8,
      marginBottom: 2,
    },
    lockedText: {
      flex: 1,
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
    },
    requestSummary: {
      ...Type.caption,
      color: c.text.secondary,
      marginTop: 6,
    },
    replayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    replayIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.teal,
      alignItems: "center",
      justifyContent: "center",
    },
    replayTitle: { ...Type.bodyMed, color: c.text.primary },
    replayMeta: { ...Type.caption, color: c.text.secondary, marginTop: 2 },
    requestActions: { flexDirection: "row", gap: 10, marginTop: 10 },
    requestBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: Radius.md,
      paddingVertical: 10,
      backgroundColor: c.tealSoft,
    },
    requestBtnText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
    },
    requestBtnDanger: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: Radius.md,
      paddingVertical: 10,
      backgroundColor: "#FEF3F2",
    },
    requestBtnDangerText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: "#B42318",
    },
    playerBackdrop: {
      flex: 1,
      backgroundColor: "rgba(8,18,32,0.58)",
      justifyContent: "flex-end",
    },
    playerSheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      padding: Space.lg,
      gap: 12,
    },
    playerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    playerTitle: { ...Type.h3, color: c.text.primary, flex: 1 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    videoPlayer: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: Radius.lg,
      overflow: "hidden",
      backgroundColor: "#000",
    },
    playerHint: { ...Type.caption, color: c.text.secondary },
  });
