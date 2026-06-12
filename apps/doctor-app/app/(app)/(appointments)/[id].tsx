import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Fonts,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { formatMoney } from "../../../src/utils/money";
import { Avatar } from "../../../src/components/common/Avatar";
import { Badge } from "../../../src/components/common/Badge";
import { Button } from "../../../src/components/common/Button";
import {
  AppHeader,
  AnimatedPressable,
  Card,
  Txt,
} from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";
import { openPrescriptionPdf } from "../../../src/utils/openPdf";
import {
  callApi,
  RecordingAsset,
  RecordingRequest,
} from "../../../src/api/call.api";

interface Appointment {
  id: string;
  appointmentId: string;
  userId: string;
  subPatientId?: string | null;
  date: string;
  time: string;
  status: string;
  type: string;
  amount: number;
  doctorEarning: number;
  details?: string;
  user?: { name: string; image?: string; mobile?: string };
  service?: { name: string };
  subPatient?: { name: string; relation: string; age?: number };
  prescription?: { id: string } | null;
}

interface RecordSummary {
  allergies?: { id: string; substance: string; severity: string }[];
  medicalConditions?: { id: string; name: string; status: string }[];
  healthProfile?: { bloodType?: string; genotype?: string } | null;
}

const statusMap: Record<
  string,
  "pending" | "confirmed" | "completed" | "cancelled"
> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export default function DoctorApptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [triage, setTriage] = useState<{
    urgency: string;
    summary: string;
    reasons: string[];
    redFlag: string | null;
    doctorFeedback: boolean | null;
  } | null>(null);

  const sendTriageFeedback = async (accurate: boolean) => {
    try {
      await doctorApi.sendTriageFeedback(id, accurate);
      setTriage((t) => (t ? { ...t, doctorFeedback: accurate } : t));
    } catch {}
  };
  const [record, setRecord] = useState<RecordSummary | null>(null);
  const [updating, setUpdating] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [fuDays, setFuDays] = useState(14);
  const [fuNote, setFuNote] = useState("");
  const [fuSaving, setFuSaving] = useState(false);
  const [fuDone, setFuDone] = useState(false);
  const [recordings, setRecordings] = useState<RecordingAsset[]>([]);
  const [recordingRequests, setRecordingRequests] = useState<
    RecordingRequest[]
  >([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingPlayback, setRecordingPlayback] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackTitle, setPlaybackTitle] = useState("Consultation replay");

  const scheduleFollowUp = async () => {
    if (!appt) return;
    setFuSaving(true);
    try {
      await doctorApi.scheduleFollowUp(
        appt.id,
        fuDays,
        fuNote.trim() || undefined,
      );
      setFuDone(true);
      setTimeout(() => {
        setFuOpen(false);
        setFuDone(false);
        setFuNote("");
        setFuDays(14);
      }, 1400);
    } catch {
    } finally {
      setFuSaving(false);
    }
  };

  useEffect(() => {
    doctorApi
      .getAppointment(id)
      .then((r: unknown) => setAppt((r as { data: Appointment }).data))
      .catch(() => {});
    // AI symptom-checker handoff (404 = patient didn't use the checker)
    doctorApi
      .getTriageSummary(id)
      .then((r: unknown) =>
        setTriage(
          (
            r as {
              data: {
                urgency: string;
                summary: string;
                reasons: string[];
                redFlag: string | null;
                doctorFeedback: boolean | null;
              };
            }
          ).data,
        ),
      )
      .catch(() => {});
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

    doctorApi
      .getMySub()
      .then((r: unknown) => {
        const entitlements = (
          r as { data?: { entitlements?: { recordingPlayback?: boolean } } }
        ).data?.entitlements;
        setRecordingPlayback(!!entitlements?.recordingPlayback);
      })
      .catch(() => setRecordingPlayback(false));
  }, [id]);

  // Pull the patient's clinical record for at-a-glance safety alerts.
  useEffect(() => {
    if (!appt?.userId) return;
    doctorApi
      .getPatientRecord(appt.userId, appt.subPatientId ?? undefined)
      .then((r: unknown) =>
        setRecord((r as { data: { patient: RecordSummary } }).data.patient),
      )
      .catch(() => {});
  }, [appt?.userId, appt?.subPatientId]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await doctorApi.updateAppointmentStatus(id, status);
      const r = await doctorApi.getAppointment(id);
      setAppt((r as { data: Appointment }).data);
    } catch {
    } finally {
      setUpdating(false);
    }
  };

  const openRecording = async (asset: RecordingAsset) => {
    if (!recordingPlayback) {
      Alert.alert(
        "Upgrade required",
        "Consultation playback review is available on doctor plans that include secure recording playback.",
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

  const placeDisputeHold = async (request: RecordingRequest) => {
    try {
      const holdUntil = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const updated = await callApi.placeRecordingDisputeHold(
        appt?.id ?? id,
        request.id,
        {
          disputeHoldUntil: holdUntil,
          disputeHoldReason: "Doctor requested dispute/quality review hold",
        },
      );
      setRecordingRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      Alert.alert(
        "Dispute hold placed",
        "Deletion is paused while the request is reviewed.",
      );
    } catch {
      Alert.alert(
        "Hold unavailable",
        "Could not place a dispute hold. Please try again later.",
      );
    }
  };

  if (!appt) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader
        title="Appointment"
        right={<Badge variant={statusMap[appt.status] ?? "info"} />}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.patientRow}>
            <Avatar
              name={appt.user?.name}
              uri={appt.user?.image}
              size={58}
              ring
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>
                {appt.user?.name ?? "Patient"}
              </Text>
              {appt.user?.mobile ? (
                <Text style={styles.meta}>{appt.user.mobile}</Text>
              ) : null}
              {appt.subPatient ? (
                <Text style={styles.metaTeal}>
                  For {appt.subPatient.name} · {appt.subPatient.relation}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* AI symptom-checker intake — what the patient told the triage assistant */}
        {triage ? (
          <Card style={styles.card}>
            <View style={styles.aiHead}>
              <Ionicons name="sparkles" size={16} color={colors.teal} />
              <Txt variant="h3" style={styles.cardTitle}>
                Leenah intake summary
              </Txt>
              <View
                style={[
                  styles.aiUrgency,
                  triage.urgency === "EMERGENCY" && {
                    backgroundColor: "rgba(240,103,92,0.12)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.aiUrgencyText,
                    triage.urgency === "EMERGENCY" && { color: colors.error },
                  ]}
                >
                  {triage.urgency.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
            <Text style={styles.aiSummary}>{triage.summary}</Text>
            {(triage.reasons ?? []).length > 0 ? (
              <Text style={styles.aiReasons}>
                {triage.reasons.map((r) => `• ${r}`).join("\n")}
              </Text>
            ) : null}
            <Text style={styles.aiNote}>
              Generated by Leenah, Doctium's AI assistant, before booking —
              verify with the patient.
            </Text>
            {triage.doctorFeedback == null ? (
              <View style={styles.fbRow}>
                <Text style={styles.fbLabel}>Was the routing right?</Text>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => sendTriageFeedback(true)}
                  style={styles.fbBtn}
                >
                  <Ionicons name="thumbs-up" size={15} color={colors.teal} />
                </AnimatedPressable>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => sendTriageFeedback(false)}
                  style={styles.fbBtn}
                >
                  <Ionicons name="thumbs-down" size={15} color={colors.error} />
                </AnimatedPressable>
              </View>
            ) : (
              <View style={styles.fbRow}>
                <Ionicons
                  name={
                    triage.doctorFeedback ? "checkmark-circle" : "close-circle"
                  }
                  size={14}
                  color={triage.doctorFeedback ? colors.teal : colors.error}
                />
                <Text style={styles.fbLabel}>
                  You marked this routing as{" "}
                  {triage.doctorFeedback ? "accurate" : "off"} — thanks!
                </Text>
              </View>
            )}
          </Card>
        ) : null}

        {/* Clinical record — safety alerts + EMR entry points */}
        <Card style={styles.card}>
          <View style={styles.recHeader}>
            <Txt variant="h3" style={styles.cardTitle}>
              Clinical record
            </Txt>
            {record?.healthProfile?.bloodType ? (
              <View style={styles.bloodPill}>
                <Ionicons name="water" size={12} color="#B42318" />
                <Text style={styles.bloodText}>
                  {record.healthProfile.bloodType}
                </Text>
              </View>
            ) : null}
          </View>

          {record &&
          (record.allergies?.length || record.medicalConditions?.length) ? (
            <View style={{ gap: 8, marginTop: 4, marginBottom: 12 }}>
              {record.allergies && record.allergies.length > 0 ? (
                <View style={styles.alertRow}>
                  <Ionicons name="warning" size={16} color="#B42318" />
                  <Text style={styles.alertText}>
                    <Text style={{ fontFamily: Fonts.bold }}>Allergies: </Text>
                    {record.allergies.map((a) => a.substance).join(", ")}
                  </Text>
                </View>
              ) : null}
              {record.medicalConditions &&
              record.medicalConditions.filter((c) => c.status === "ACTIVE")
                .length > 0 ? (
                <View style={[styles.alertRow, styles.condRow]}>
                  <Ionicons name="pulse" size={16} color={colors.tealDeep} />
                  <Text style={[styles.alertText, { color: colors.tealDeep }]}>
                    <Text style={{ fontFamily: Fonts.bold }}>Conditions: </Text>
                    {record.medicalConditions
                      .filter((c) => c.status === "ACTIVE")
                      .map((c) => c.name)
                      .join(", ")}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.recEmpty}>
              No allergies or chronic conditions on file.
            </Text>
          )}

          <View style={styles.recBtns}>
            <Button
              label="Full history"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({
                  pathname: "/(app)/(emr)/[userId]",
                  params: {
                    userId: appt.userId,
                    ...(appt.subPatientId
                      ? { subPatientId: appt.subPatientId }
                      : {}),
                  },
                })
              }
              icon={
                <Ionicons
                  name="folder-open-outline"
                  size={17}
                  color={colors.navy}
                />
              }
            />
            <Button
              label="SOAP note"
              style={{ flex: 1 }}
              onPress={() => router.push(`/(app)/(emr)/soap/${appt.id}`)}
              icon={<Ionicons name="create-outline" size={17} color="#fff" />}
            />
          </View>

          <CareBrief appointmentId={appt.id} />
          {appt.status === "CONFIRMED" || appt.status === "COMPLETED" ? (
            <AnimatedPressable
              haptic="light"
              onPress={() => setFuOpen(true)}
              style={styles.fuTrigger}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.tealDeep}
              />
              <Text style={styles.fuTriggerText}>Schedule a follow-up</Text>
              <Ionicons
                name="chevron-forward"
                size={15}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>
          ) : null}
          {appt.status === "CONFIRMED" || appt.status === "COMPLETED" ? (
            <AnimatedPressable
              haptic="light"
              onPress={() =>
                router.push({
                  pathname: "/(app)/(referrals)/new",
                  params: { appointmentId: appt.id },
                })
              }
              style={styles.refTrigger}
            >
              <Ionicons
                name="git-network-outline"
                size={16}
                color={colors.navy}
              />
              <Text style={styles.refTriggerText}>Refer to a specialist</Text>
              <Ionicons
                name="chevron-forward"
                size={15}
                color={colors.text.tertiary}
              />
            </AnimatedPressable>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            Details
          </Txt>
          <InfoRow
            icon="pricetag-outline"
            label="Reference"
            value={`#${appt.appointmentId.slice(-8).toUpperCase()}`}
          />
          <InfoRow
            icon="medkit-outline"
            label="Service"
            value={appt.service?.name ?? "General consultation"}
          />
          <InfoRow icon="calendar-outline" label="Date" value={appt.date} />
          <InfoRow icon="time-outline" label="Time" value={appt.time} />
          <InfoRow
            icon={
              appt.type === "ONLINE" ? "videocam-outline" : "business-outline"
            }
            label="Type"
            value={appt.type === "ONLINE" ? "Video call" : "Clinic visit"}
            last
          />
          {appt.details ? (
            <View style={styles.note}>
              <Ionicons
                name="document-text-outline"
                size={16}
                color={colors.teal}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.noteText}>{appt.details}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={styles.cardTitle}>
            Your earnings
          </Txt>
          <InfoRow
            icon="card-outline"
            label="Patient paid"
            value={formatMoney(appt.amount)}
          />
          <View style={styles.earnRow}>
            <View style={styles.earnLeft}>
              <Ionicons
                name="wallet-outline"
                size={17}
                color={colors.tealDeep}
              />
              <Text style={styles.earnLabel}>Your share</Text>
            </View>
            <Text style={styles.earnValue}>
              {formatMoney(appt.doctorEarning)}
            </Text>
          </View>
        </Card>

        <RecordingCard
          assets={recordings}
          requests={recordingRequests}
          loading={recordingsLoading}
          playbackEnabled={recordingPlayback}
          onOpen={openRecording}
          onUpgrade={() => router.push("/(app)/(subscription)")}
          onHold={placeDisputeHold}
        />

        {appt.status === "CONFIRMED" ? (
          <View style={{ gap: 12 }}>
            {appt.type === "ONLINE" ? (
              <Button
                label="Start video call"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(chat)/call",
                    params: { appointmentId: appt.id },
                  })
                }
                icon={<Ionicons name="videocam" size={18} color="#fff" />}
              />
            ) : null}
            <Button
              label="Mark as complete"
              onPress={() => updateStatus("COMPLETED")}
              loading={updating}
              variant="secondary"
              icon={<Ionicons name="checkmark-done" size={18} color="#fff" />}
            />
          </View>
        ) : null}

        {appt.status === "CONFIRMED" || appt.status === "COMPLETED" ? (
          <View style={{ marginTop: 12 }}>
            {appt.prescription ? (
              <Button
                label="View prescription"
                variant="outline"
                onPress={() => openPrescriptionPdf(appt.prescription!.id)}
                icon={
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={colors.navy}
                  />
                }
              />
            ) : (
              <Button
                label="Write prescription"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(prescriptions)/create",
                    params: { appointmentId: appt.id },
                  })
                }
                icon={<Ionicons name="create-outline" size={18} color="#fff" />}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      <RecordingPlayer
        title={playbackTitle}
        url={playbackUrl}
        onClose={() => setPlaybackUrl(null)}
      />

      <Modal
        visible={fuOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFuOpen(false)}
      >
        <Pressable style={styles.fuBackdrop} onPress={() => setFuOpen(false)} />
        <View style={styles.fuSheet}>
          <View style={styles.fuHandle} />
          {fuDone ? (
            <View style={styles.fuDone}>
              <Ionicons name="checkmark-circle" size={42} color={colors.teal} />
              <Text style={styles.fuDoneText}>
                Follow-up scheduled — {appt.user?.name ?? "the patient"} will be
                reminded.
              </Text>
            </View>
          ) : (
            <>
              <Txt variant="h2" style={{ marginBottom: 4 }}>
                Schedule follow-up
              </Txt>
              <Text style={styles.fuHint}>
                We'll remind the patient to book a return visit.
              </Text>
              <Text style={styles.fuLabel}>When</Text>
              <View style={styles.fuChips}>
                {[
                  { d: 7, label: "1 week" },
                  { d: 14, label: "2 weeks" },
                  { d: 30, label: "1 month" },
                  { d: 90, label: "3 months" },
                ].map((o) => {
                  const active = fuDays === o.d;
                  return (
                    <AnimatedPressable
                      key={o.d}
                      haptic="light"
                      onPress={() => setFuDays(o.d)}
                      style={[styles.fuChip, active && styles.fuChipActive]}
                    >
                      <Text
                        style={[styles.fuChipText, active && { color: "#fff" }]}
                      >
                        {o.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
              <Text style={styles.fuLabel}>Note (optional)</Text>
              <TextInput
                style={styles.fuInput}
                value={fuNote}
                onChangeText={setFuNote}
                placeholder="e.g. Review blood pressure & repeat labs"
                placeholderTextColor={colors.text.tertiary}
                multiline
              />
              <Button
                label={`Schedule in ${fuDays} days`}
                onPress={scheduleFollowUp}
                loading={fuSaving}
                style={{ marginTop: 6 }}
              />
            </>
          )}
        </View>
      </Modal>
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
  onHold,
}: {
  assets: RecordingAsset[];
  requests: RecordingRequest[];
  loading: boolean;
  playbackEnabled: boolean;
  onOpen: (asset: RecordingAsset) => void;
  onUpgrade: () => void;
  onHold: (request: RecordingRequest) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
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
            name={playbackEnabled ? "lock-closed" : "ribbon"}
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
            Upgrade to review this consultation securely.
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.text.tertiary}
          />
        </Pressable>
      ) : null}
      {latestRequest ? (
        <View style={styles.requestBox}>
          <Text style={styles.requestSummary}>
            Latest request: {latestRequest.type.toLowerCase()} is{" "}
            {latestRequest.status.toLowerCase()}
          </Text>
          {latestRequest.type === "DELETE" &&
          latestRequest.status === "PENDING" &&
          !latestRequest.disputeHold ? (
            <Pressable
              onPress={() => onHold(latestRequest)}
              style={styles.holdBtn}
            >
              <Ionicons
                name="shield-outline"
                size={15}
                color={colors.tealDeep}
              />
              <Text style={styles.holdBtnText}>Place dispute hold</Text>
            </Pressable>
          ) : latestRequest.disputeHold ? (
            <Text style={styles.holdActiveText}>Dispute hold active</Text>
          ) : null}
        </View>
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
            name={playbackEnabled ? "chevron-forward" : "ribbon-outline"}
            size={18}
            color={colors.text.tertiary}
          />
        </Pressable>
      ))}
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
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

/**
 * Pre-visit brief (SCD Phase 4): genotype, live crisis risk + factors, crisis
 * picture and goals from the patient's care program. Renders nothing when the
 * patient isn't in a crisis-tracked program — the fetch 404s silently.
 */
function CareBrief({ appointmentId }: { appointmentId: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  interface Brief {
    summary: string;
    program: { name: string };
    risk: {
      score: number;
      level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
      factors: { key: string; label: string; points: number }[];
    };
    crisisStats: {
      count90d: number;
      hospitalizations90d: number;
      topTriggers: { trigger: string; count: number }[];
    };
    adherence: { percent: number | null };
    activeGoals: { title: string }[];
  }
  const [brief, setBrief] = useState<Brief | null>(null);

  useEffect(() => {
    doctorApi
      .getCareBrief(appointmentId)
      .then((r: unknown) => setBrief((r as { data: Brief }).data ?? null))
      .catch(() => setBrief(null));
  }, [appointmentId]);

  if (!brief) return null;
  const riskColor =
    brief.risk.level === "LOW"
      ? colors.teal
      : brief.risk.level === "MODERATE"
        ? colors.warning
        : colors.error;
  return (
    <View style={styles.briefCard}>
      <View style={styles.briefHead}>
        <Ionicons name="pulse" size={15} color={colors.navyMid} />
        <Text style={styles.briefTitle}>Pre-visit brief</Text>
      </View>
      <Text style={[styles.briefSummary, { color: riskColor }]}>
        {brief.summary}
      </Text>
      {brief.risk.factors.map((f) => (
        <Text key={f.key} style={styles.briefLine}>
          • {f.label}
        </Text>
      ))}
      {brief.crisisStats.topTriggers.length ? (
        <Text style={styles.briefLine}>
          Top triggers:{" "}
          {brief.crisisStats.topTriggers
            .map((t) => `${t.trigger} (${t.count})`)
            .join(", ")}
        </Text>
      ) : null}
      {brief.activeGoals.length ? (
        <Text style={styles.briefLine}>
          Active goals: {brief.activeGoals.map((g) => g.title).join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
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
    // Pre-visit brief (SCD Phase 4)
    briefCard: {
      backgroundColor: c.tealSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 14,
      marginTop: 12,
    },
    briefHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: 6,
    },
    briefTitle: { fontFamily: Fonts.bold, fontSize: 14, color: c.text.primary },
    briefSummary: { fontFamily: Fonts.bold, fontSize: 13, marginBottom: 8 },
    briefLine: {
      ...Type.caption,
      color: c.text.secondary,
      lineHeight: 18,
      marginBottom: 3,
    },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 40, paddingTop: 4 },
    card: { marginBottom: 14 },
    cardTitle: { marginBottom: 6 },
    patientRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    patientName: { ...Type.h3, color: c.text.primary },
    meta: { ...Type.caption, color: c.text.secondary, marginTop: 3 },
    metaTeal: { ...Type.caption, color: c.tealDeep, marginTop: 3 },
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
    note: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      padding: 12,
    },
    noteText: { flex: 1, ...Type.bodySm, color: c.text.secondary },
    earnRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.tealSoft,
      borderRadius: Radius.md,
      padding: 14,
      marginTop: 10,
    },
    earnLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    earnLabel: { ...Type.bodyMed, color: c.tealDeep },
    earnValue: {
      fontFamily: Fonts.extrabold,
      fontSize: 20,
      color: c.tealDeep,
      letterSpacing: -0.4,
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
    requestBox: {
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      padding: 12,
      marginTop: 8,
      gap: 8,
    },
    requestSummary: { ...Type.caption, color: c.text.secondary },
    holdBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: Radius.md,
      paddingVertical: 10,
      backgroundColor: c.tealSoft,
    },
    holdBtnText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
    },
    holdActiveText: {
      ...Type.caption,
      fontFamily: Fonts.semibold,
      color: c.tealDeep,
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
    actionsRow: { flexDirection: "row", gap: 12 },
    recHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    aiHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    aiUrgency: {
      marginLeft: "auto",
      backgroundColor: "rgba(44,183,167,0.12)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.round,
    },
    aiUrgencyText: {
      fontFamily: Fonts.bold,
      fontSize: 10.5,
      color: c.teal,
      letterSpacing: 0.4,
    },
    aiSummary: {
      ...Type.bodySm,
      color: c.text.primary,
      lineHeight: 20,
      marginTop: 10,
    },
    aiReasons: {
      ...Type.caption,
      color: c.text.secondary,
      lineHeight: 18,
      marginTop: 8,
    },
    aiNote: {
      ...Type.caption,
      fontSize: 10.5,
      color: c.text.tertiary,
      marginTop: 10,
      fontStyle: "italic",
    },
    fbRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
    },
    fbLabel: { ...Type.caption, color: c.text.secondary, flex: 1 },
    fbBtn: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    bloodPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(217,45,32,0.1)",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
    },
    bloodText: { fontFamily: Fonts.bold, fontSize: 12, color: "#B42318" },
    alertRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      backgroundColor: "rgba(217,45,32,0.07)",
      borderRadius: Radius.md,
      padding: 10,
    },
    condRow: { backgroundColor: c.tealSoft },
    alertText: { flex: 1, ...Type.bodySm, color: "#B42318", lineHeight: 18 },
    recEmpty: {
      ...Type.bodySm,
      color: c.text.tertiary,
      marginTop: 2,
      marginBottom: 12,
    },
    recBtns: { flexDirection: "row", gap: 10 },
    fuTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.tealSoft,
    },
    fuTriggerText: {
      flex: 1,
      ...Type.bodyMed,
      color: c.tealDeep,
      fontFamily: Fonts.semibold,
    },
    refTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: "rgba(19,49,87,0.06)",
    },
    refTriggerText: {
      flex: 1,
      ...Type.bodyMed,
      color: c.navy,
      fontFamily: Fonts.semibold,
    },
    fuBackdrop: { flex: 1, backgroundColor: "rgba(8,18,32,0.45)" },
    fuSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      padding: Space.xxl,
      paddingBottom: 40,
    },
    fuHandle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginBottom: 16,
    },
    fuHint: { ...Type.caption, color: c.text.tertiary, marginBottom: 18 },
    fuLabel: { ...Type.label, color: c.text.secondary, marginBottom: 9 },
    fuChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
      marginBottom: 18,
    },
    fuChip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    fuChipActive: { backgroundColor: c.teal, borderColor: c.teal },
    fuChipText: {
      fontFamily: Fonts.semibold,
      fontSize: 13.5,
      color: c.text.secondary,
    },
    fuInput: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      padding: 13,
      ...Type.bodyMed,
      color: c.text.primary,
      minHeight: 70,
      textAlignVertical: "top",
    },
    fuDone: { alignItems: "center", gap: 12, paddingVertical: 30 },
    fuDoneText: {
      ...Type.body,
      color: c.text.secondary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
  });
