import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Fonts,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
  type Palette,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import {
  AppHeader,
  AnimatedPressable,
  Card,
  Txt,
} from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

interface KycDoc {
  id: string;
  type: string;
  fileUrl: string;
  status: string;
  createdAt: string;
}
interface Kyc {
  status: string;
  isVerified: boolean;
  rejectionReason: string;
  licenseExpiry?: string | null;
  requiredDocs: string[];
  missingDocs: string[];
  documents: KycDoc[];
}

const DOC_LABEL: Record<string, string> = {
  CV: "CV / Résumé",
  MEDICAL_LICENSE: "MDCN Practising Licence",
  DEGREE_CERTIFICATE: "Medical Degree",
  GOVERNMENT_ID: "Government ID",
  SPECIALIST_CERT: "Specialist Certificate",
  INDEMNITY_INSURANCE: "Indemnity Insurance",
  PASSPORT_PHOTO: "Passport Photo",
  OTHER: "Other Document",
};

type BannerEntry = {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  title: string;
  body: string;
};

const bannerMap = (c: Palette): Record<string, BannerEntry> => ({
  NEW: {
    icon: "cloud-upload-outline",
    bg: c.skySoft,
    fg: c.navy,
    title: "Verify your account",
    body: "Upload your verification documents below, then submit for review to get your Verified badge and start seeing patients.",
  },
  PENDING_KYC: {
    icon: "cloud-upload-outline",
    bg: c.tealSoft,
    fg: c.tealDeep,
    title: "Complete your verification",
    body: "Upload the required documents below, then submit for review to get your Verified badge.",
  },
  UNDER_REVIEW: {
    icon: "hourglass-outline",
    bg: c.skySoft,
    fg: c.navy,
    title: "Under review",
    body: "Your documents have been submitted. We’ll notify you once verification is complete.",
  },
  VERIFIED: {
    icon: "shield-checkmark",
    bg: c.successSoft,
    fg: c.success,
    title: "You’re verified",
    body: "Your Verified badge is live and patients can find and book you.",
  },
  REJECTED: {
    icon: "alert-circle-outline",
    bg: c.errorSoft,
    fg: c.error,
    title: "Action needed",
    body: "Your verification needs attention — please review and re-submit.",
  },
  EXPIRED: {
    icon: "warning-outline",
    bg: c.warningSoft,
    fg: c.warning,
    title: "Licence expired",
    body: "Your Verified badge is paused. Upload your renewed MDCN licence to get re-verified.",
  },
});

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

export default function VerificationScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [kyc, setKyc] = useState<Kyc | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await doctorApi.getMyKyc();
      setKyc((r as { data: Kyc }).data ?? null);
    } catch {}
  }, []);
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const canUpload = kyc
    ? ["NEW", "PENDING_KYC", "REJECTED", "EXPIRED"].includes(kyc.status)
    : false;

  const send = async (
    type: string,
    dataUrl: string,
    fileName?: string,
    mimeType?: string,
  ) => {
    setBusy(type);
    try {
      await doctorApi.uploadKycDoc({ type, dataUrl, fileName, mimeType });
      await load();
    } catch (e) {
      Alert.alert(
        "Upload failed",
        (e as { message?: string })?.message ?? "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = async (type: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.6,
    });
    const a = res.assets?.[0];
    if (!res.canceled && a?.base64)
      await send(
        type,
        `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}`,
        a.fileName ?? undefined,
        a.mimeType ?? undefined,
      );
  };

  const pickFile = async (type: string) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    const a = res.assets?.[0];
    if (!res.canceled && a?.uri) {
      setBusy(type);
      try {
        const dataUrl = await uriToDataUrl(a.uri);
        await doctorApi.uploadKycDoc({
          type,
          dataUrl,
          fileName: a.name,
          mimeType: a.mimeType,
        });
        await load();
      } catch (e) {
        Alert.alert(
          "Upload failed",
          (e as { message?: string })?.message ?? "Please try again.",
        );
      } finally {
        setBusy(null);
      }
    }
  };

  const chooseSource = (type: string) => {
    Alert.alert(DOC_LABEL[type] ?? type, "Choose how to upload", [
      { text: "Photo from library", onPress: () => pickPhoto(type) },
      { text: "File (PDF / image)", onPress: () => pickFile(type) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await doctorApi.submitKyc();
      await load();
      Alert.alert(
        "Submitted",
        "Your documents are now under review. We’ll notify you once verified.",
      );
    } catch (e) {
      Alert.alert(
        "Cannot submit yet",
        (e as { message?: string })?.message ?? "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader title="Verification" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      </View>
    );
  }

  const status = kyc?.status ?? "NEW";
  const BANNER = bannerMap(colors);
  const banner = (BANNER[status] ?? BANNER.NEW)!;
  const uploadedTypes = new Set((kyc?.documents ?? []).map((d) => d.type));

  return (
    <View style={styles.root}>
      <AppHeader title="Verification & licences" />
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
      >
        <View style={[styles.banner, { backgroundColor: banner.bg }]}>
          <Ionicons name={banner.icon} size={26} color={banner.fg} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: banner.fg }]}>
              {banner.title}
            </Text>
            <Text style={styles.bannerBody}>
              {status === "REJECTED" && kyc?.rejectionReason
                ? kyc.rejectionReason
                : banner.body}
            </Text>
            {status === "VERIFIED" && kyc?.licenseExpiry ? (
              <Text style={[styles.bannerBody, { marginTop: 4 }]}>
                Licence valid until{" "}
                {new Date(kyc.licenseExpiry).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                .
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Required documents</Text>
        {(kyc?.requiredDocs ?? []).map((type) => {
          const has = uploadedTypes.has(type);
          const doc = (kyc?.documents ?? []).find((d) => d.type === type);
          return (
            <Card key={type} style={styles.docCard}>
              <View style={styles.docRow}>
                <View
                  style={[
                    styles.docIcon,
                    {
                      backgroundColor: has
                        ? colors.successSoft
                        : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons
                    name={has ? "checkmark" : "document-text-outline"}
                    size={18}
                    color={has ? colors.success : colors.text.secondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{DOC_LABEL[type] ?? type}</Text>
                  <Text style={styles.docStatus}>
                    {has
                      ? doc?.status === "REJECTED"
                        ? "Rejected — re-upload"
                        : doc?.status === "APPROVED"
                          ? "Approved"
                          : "Uploaded"
                      : "Not uploaded"}
                  </Text>
                </View>
                {canUpload ? (
                  busy === type ? (
                    <ActivityIndicator color={colors.teal} />
                  ) : (
                    <AnimatedPressable
                      haptic="light"
                      onPress={() => chooseSource(type)}
                      style={styles.uploadBtn}
                    >
                      <Ionicons
                        name={has ? "refresh" : "cloud-upload-outline"}
                        size={16}
                        color={colors.navy}
                      />
                      <Text style={styles.uploadTxt}>
                        {has ? "Replace" : "Upload"}
                      </Text>
                    </AnimatedPressable>
                  )
                ) : null}
              </View>
            </Card>
          );
        })}

        {canUpload ? (
          <View style={{ marginTop: 8 }}>
            <Button
              label={submitting ? "Submitting…" : "Submit for review"}
              onPress={submit}
              loading={submitting}
              disabled={(kyc?.missingDocs?.length ?? 1) > 0}
              icon={
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color="#fff"
                />
              }
            />
            {(kyc?.missingDocs?.length ?? 0) > 0 ? (
              <Text style={styles.hint}>
                Upload all required documents to submit.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: Space.xl, paddingBottom: 130 },
    banner: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-start",
      padding: 16,
      borderRadius: Radius.xl,
      marginTop: 8,
    },
    bannerTitle: { ...Type.h3 },
    bannerBody: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginTop: 3,
      lineHeight: 19,
    },
    sectionTitle: {
      ...Type.h2,
      color: c.text.primary,
      marginTop: 24,
      marginBottom: 12,
    },
    docCard: { marginBottom: 12 },
    docRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    docIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    docName: {
      ...Type.bodyMed,
      color: c.text.primary,
      fontFamily: Fonts.semibold,
    },
    docStatus: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    uploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.round,
    },
    uploadTxt: { fontFamily: Fonts.semibold, fontSize: 13, color: c.navy },
    hint: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      marginTop: 10,
    },
  });
