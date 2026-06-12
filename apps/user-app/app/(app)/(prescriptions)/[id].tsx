import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Palette,
  Fonts,
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
import { prescriptionsApi } from "../../../src/api/prescriptions.api";
import { openPrescriptionPdf } from "../../../src/utils/openPdf";

interface Item {
  id: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  refills: number;
  instructions: string;
}
interface Rx {
  id: string;
  code: string;
  status: "ISSUED" | "DISPENSED" | "CANCELLED";
  signedAt: string;
  diagnosis: string;
  notes: string;
  doctor?: { name: string; image?: string; designation?: string };
  subPatient?: { name: string } | null;
  items: Item[];
}

const STATUS: Record<
  Rx["status"],
  { variant: "confirmed" | "completed" | "cancelled"; label: string }
> = {
  ISSUED: { variant: "confirmed", label: "Active" },
  DISPENSED: { variant: "completed", label: "Dispensed" },
  CANCELLED: { variant: "cancelled", label: "Cancelled" },
};

type RefillStatus = "PENDING" | "APPROVED" | "DECLINED";
interface RefillReq {
  id: string;
  status: RefillStatus;
  doctorNote: string;
  createdAt: string;
}
const REFILL: Record<
  RefillStatus,
  { variant: "pending" | "completed" | "cancelled"; label: string }
> = {
  PENDING: { variant: "pending", label: "Refill requested" },
  APPROVED: { variant: "completed", label: "Refill approved" },
  DECLINED: { variant: "cancelled", label: "Refill declined" },
};

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rx, setRx] = useState<Rx | null>(null);
  const [requests, setRequests] = useState<RefillReq[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const loadRequests = () =>
    prescriptionsApi
      .getRefillRequests(id)
      .then((r: unknown) =>
        setRequests((r as { data: RefillReq[] }).data ?? []),
      )
      .catch(() => {});

  useEffect(() => {
    prescriptionsApi
      .getOne(id)
      .then((r: unknown) => setRx((r as { data: Rx }).data))
      .catch(() => {});
    loadRequests();
  }, [id]);

  const download = async () => {
    setDownloading(true);
    try {
      await openPrescriptionPdf(id);
    } catch {
      /* ignore */
    } finally {
      setDownloading(false);
    }
  };

  const requestRefill = async () => {
    setRequesting(true);
    try {
      await prescriptionsApi.requestRefill(id);
      await loadRequests();
    } catch {
      /* surfaced elsewhere */
    } finally {
      setRequesting(false);
    }
  };

  const confirmRequest = () =>
    Alert.alert(
      "Request refill",
      "Send a refill request to your doctor for this prescription?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Request", onPress: requestRefill },
      ],
    );

  if (!rx) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  const s = STATUS[rx.status];
  const issued = new Date(rx.signedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const hasRefillsLeft = rx.items.some((i) => i.refills > 0);
  const latest = requests[0];
  const pending = latest?.status === "PENDING";
  const canRequest = rx.status !== "CANCELLED" && hasRefillsLeft && !pending;

  return (
    <View style={styles.root}>
      <AppHeader
        title="Prescription"
        right={<Badge variant={s.variant} label={s.label} />}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.docRow}>
            <Avatar
              uri={rx.doctor?.image}
              name={rx.doctor?.name}
              size={54}
              ring
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>
                Dr. {rx.doctor?.name ?? "Doctor"}
              </Text>
              <Text style={styles.docSpec}>
                {rx.doctor?.designation || "General practitioner"}
              </Text>
              <Text style={styles.issued}>Issued {issued}</Text>
            </View>
          </View>
          {rx.subPatient ? (
            <Text style={styles.forPatient}>For {rx.subPatient.name}</Text>
          ) : null}
        </Card>

        {rx.diagnosis ? (
          <Card style={styles.card}>
            <Text style={styles.label}>DIAGNOSIS</Text>
            <Text style={styles.body}>{rx.diagnosis}</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.rxHead}>
            <Text style={styles.rxSymbol}>℞</Text>
            <Txt variant="h3">Medications</Txt>
          </View>
          {rx.items.map((it, i) => (
            <View
              key={it.id}
              style={[styles.med, i < rx.items.length - 1 && styles.medBorder]}
            >
              <View style={styles.medTop}>
                <Text style={styles.drug}>{it.drugName}</Text>
                {it.refills > 0 ? (
                  <Text style={styles.refills}>
                    {it.refills} refill{it.refills === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </View>
              <View style={styles.tags}>
                {it.dosage ? (
                  <Tag icon="flask-outline" text={it.dosage} />
                ) : null}
                {it.frequency ? (
                  <Tag icon="repeat-outline" text={it.frequency} />
                ) : null}
                {it.duration ? (
                  <Tag icon="time-outline" text={it.duration} />
                ) : null}
              </View>
              {it.instructions ? (
                <Text style={styles.instr}>↳ {it.instructions}</Text>
              ) : null}
            </View>
          ))}
        </Card>

        {rx.notes ? (
          <Card style={styles.card}>
            <Text style={styles.label}>NOTES</Text>
            <Text style={styles.body}>{rx.notes}</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.refillHead}>
            <Txt variant="h3">Refills</Txt>
            {latest ? (
              <Badge
                variant={REFILL[latest.status].variant}
                label={REFILL[latest.status].label}
              />
            ) : null}
          </View>
          {latest?.status === "DECLINED" && latest.doctorNote ? (
            <Text style={styles.declineNote}>
              Doctor’s note: {latest.doctorNote}
            </Text>
          ) : null}
          {!hasRefillsLeft ? (
            <Text style={styles.refillHint}>
              No authorised refills remaining on this prescription.
            </Text>
          ) : pending ? (
            <Text style={styles.refillHint}>
              Your request is awaiting your doctor’s approval.
            </Text>
          ) : null}
          <Button
            label={pending ? "Refill requested" : "Request refill"}
            variant="secondary"
            onPress={confirmRequest}
            loading={requesting}
            disabled={!canRequest}
            icon={<Ionicons name="repeat" size={18} color="#fff" />}
            style={{ marginTop: 12 }}
          />
        </Card>

        <View style={styles.verify}>
          <View style={styles.verifyTop}>
            <View style={styles.verifyIcon}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>
                Digitally signed & verifiable
              </Text>
              <Text style={styles.verifySub}>
                Carries an Ed25519 signature. The PDF includes a QR code anyone
                can scan to confirm authenticity.
              </Text>
            </View>
          </View>
          <Text style={styles.code}>Ref: {rx.code}</Text>
        </View>

        <Button
          label="Download / view PDF"
          onPress={download}
          loading={downloading}
          icon={<Ionicons name="download-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </View>
  );
}

function Tag({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={13} color={colors.tealDeep} />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: Space.xl, paddingBottom: 44, paddingTop: 4 },
    card: { marginBottom: 14 },
    docRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    docName: { ...Type.h3, color: c.text.primary },
    docSpec: { ...Type.bodySm, color: c.text.secondary, marginTop: 2 },
    issued: { ...Type.caption, color: c.text.tertiary, marginTop: 4 },
    forPatient: {
      ...Type.caption,
      color: c.tealDeep,
      marginTop: 12,
      fontFamily: Fonts.semibold,
    },
    label: { ...Type.overline, color: c.text.tertiary, marginBottom: 8 },
    body: { ...Type.body, color: c.text.primary, lineHeight: 22 },
    rxHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    rxSymbol: { fontFamily: Fonts.extrabold, fontSize: 20, color: c.teal },
    med: { paddingVertical: 12 },
    medBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    medTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    drug: {
      ...Type.bodyMed,
      color: c.text.primary,
      fontFamily: Fonts.bold,
      flex: 1,
    },
    refills: {
      ...Type.caption,
      color: c.navyMid,
      backgroundColor: c.navySoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.round,
      overflow: "hidden",
      fontFamily: Fonts.semibold,
    },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: c.tealSoft,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: Radius.md,
    },
    tagText: {
      ...Type.caption,
      color: c.tealDeep,
      fontFamily: Fonts.semibold,
    },
    instr: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginTop: 9,
      fontStyle: "italic",
    },
    refillHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    declineNote: { ...Type.bodySm, color: c.error, marginTop: 10 },
    refillHint: { ...Type.caption, color: c.text.tertiary, marginTop: 10 },
    verify: {
      backgroundColor: c.navy,
      borderRadius: Radius.xl,
      padding: 16,
      marginBottom: 14,
    },
    verifyTop: { flexDirection: "row", gap: 12 },
    verifyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(139,187,233,0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    verifyTitle: { ...Type.bodyMed, color: "#fff", fontFamily: Fonts.bold },
    verifySub: {
      ...Type.caption,
      color: c.text.onDarkDim,
      marginTop: 4,
      lineHeight: 17,
    },
    code: {
      ...Type.caption,
      color: c.text.onDarkDim,
      marginTop: 12,
      fontFamily: Fonts.medium,
    },
  });
