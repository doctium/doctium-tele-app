import React, { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import SignatureScreenView, {
  SignatureViewRef,
} from "react-native-signature-canvas";
import {
  Palette,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import {
  AppHeader,
  Card,
  Txt,
  AnimatedPressable,
} from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";

type Mode = "draw" | "upload";

// Hide the canvas library's built-in footer; we drive it with our own buttons.
const PAD_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body, html { width: 100%; height: 100%; background: #fff; }
`;

export default function SignatureScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const padRef = useRef<SignatureViewRef>(null);
  const [mode, setMode] = useState<Mode>("draw");
  const [existing, setExisting] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    doctorApi
      .getProfile()
      .then((r: unknown) => {
        const sig = (r as { data?: { signatureImage?: string } }).data
          ?.signatureImage;
        if (sig) setExisting(sig);
      })
      .catch(() => {});
  }, []);

  const persist = async (value: string) => {
    setLoading(true);
    setError("");
    try {
      await doctorApi.updateSignature(value);
      setExisting(value);
      setSaved(true);
    } catch (e) {
      setError(
        (e as { message?: string })?.message ?? "Could not save signature",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Draw mode ──
  const saveDrawing = () => {
    setSaved(false);
    padRef.current?.readSignature();
  };
  const onDrawOK = (sig: string) => {
    void persist(sig);
  };
  const onDrawEmpty = () => setError("Please draw your signature first.");
  const clearDrawing = () => {
    padRef.current?.clearSignature();
    setSaved(false);
    setError("");
  };

  // ── Upload mode ──
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.8,
    });
    const a = res.assets?.[0];
    if (!res.canceled && a?.base64) {
      setUploadUrl(`data:${a.mimeType ?? "image/png"};base64,${a.base64}`);
      setSaved(false);
      setError("");
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSaved(false);
    setError("");
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Prescription signature" />
      <View style={styles.body}>
        <Card style={styles.card}>
          <Txt variant="h3" style={{ marginBottom: 6 }}>
            Your signature
          </Txt>
          <Text style={styles.sub}>
            Printed on every prescription PDF you issue, alongside the digital
            signature seal.
          </Text>

          <View style={styles.segment}>
            {(["draw", "upload"] as Mode[]).map((m) => (
              <AnimatedPressable
                key={m}
                haptic="light"
                onPress={() => switchMode(m)}
                style={[styles.segBtn, mode === m && styles.segBtnActive]}
              >
                <Ionicons
                  name={m === "draw" ? "brush-outline" : "image-outline"}
                  size={16}
                  color={mode === m ? "#fff" : colors.text.secondary}
                />
                <Text
                  style={[styles.segTxt, mode === m && styles.segTxtActive]}
                >
                  {m === "draw" ? "Draw" : "Upload"}
                </Text>
              </AnimatedPressable>
            ))}
          </View>

          {mode === "draw" ? (
            <>
              <View style={styles.canvasBox}>
                <SignatureScreenView
                  ref={padRef}
                  onOK={onDrawOK}
                  onEmpty={onDrawEmpty}
                  autoClear={false}
                  descriptionText=""
                  webStyle={PAD_STYLE}
                  backgroundColor="#FFFFFF"
                  penColor="#0B1B30"
                />
                <Text style={styles.canvasHint}>Sign with your finger</Text>
              </View>
              <View style={styles.row}>
                <Button
                  label="Clear"
                  variant="outline"
                  onPress={clearDrawing}
                  style={{ flex: 1 }}
                />
                <Button
                  label={saved ? "Saved ✓" : "Save signature"}
                  loading={loading}
                  onPress={saveDrawing}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.preview}>
                {uploadUrl || existing ? (
                  <Image
                    source={{ uri: uploadUrl ?? existing ?? undefined }}
                    style={styles.sigImg}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.empty}>
                    <Ionicons
                      name="image-outline"
                      size={30}
                      color={colors.text.tertiary}
                    />
                    <Text style={styles.emptyTxt}>No signature image yet</Text>
                  </View>
                )}
              </View>
              <Button
                label={
                  uploadUrl || existing
                    ? "Change image"
                    : "Upload signature image"
                }
                variant="outline"
                onPress={pick}
                icon={
                  <Ionicons
                    name="image-outline"
                    size={18}
                    color={colors.navy}
                  />
                }
                style={{ marginBottom: 12 }}
              />
              <Button
                label={saved ? "Saved ✓" : "Save signature"}
                onPress={() => uploadUrl && persist(uploadUrl)}
                loading={loading}
                disabled={!uploadUrl}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        {existing && !saved ? (
          <View style={styles.currentRow}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.success}
            />
            <Text style={styles.currentTxt}>
              A signature is already saved on your account.
            </Text>
          </View>
        ) : null}

        <Text style={styles.tip}>
          Tip: a drawn signature gives the cleanest, transparent result on the
          PDF.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    body: { paddingHorizontal: Space.xl, paddingTop: 4 },
    card: { marginBottom: 14 },
    sub: {
      ...Type.bodySm,
      color: c.text.secondary,
      marginBottom: 16,
      lineHeight: 19,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: c.surfaceAlt,
      borderRadius: Radius.md,
      padding: 4,
      gap: 4,
      marginBottom: 16,
    },
    segBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: Radius.sm,
    },
    segBtnActive: { backgroundColor: c.navy },
    segTxt: { ...Type.label, color: c.text.secondary },
    segTxtActive: { color: "#fff" },
    canvasBox: {
      height: 190,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderStyle: "dashed",
      overflow: "hidden",
      marginBottom: 14,
      backgroundColor: "#fff",
    },
    canvasHint: {
      position: "absolute",
      bottom: 8,
      alignSelf: "center",
      ...Type.caption,
      color: c.text.tertiary,
    },
    row: { flexDirection: "row", gap: 12 },
    preview: {
      height: 150,
      borderRadius: Radius.lg,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      overflow: "hidden",
    },
    sigImg: { width: "86%", height: "74%" },
    empty: { alignItems: "center", gap: 8 },
    emptyTxt: { ...Type.caption, color: c.text.tertiary },
    error: {
      ...Type.bodySm,
      color: c.error,
      marginTop: 12,
      textAlign: "center",
    },
    currentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "center",
      marginBottom: 12,
    },
    currentTxt: { ...Type.caption, color: c.text.secondary },
    tip: {
      ...Type.caption,
      color: c.text.tertiary,
      textAlign: "center",
      paddingHorizontal: 10,
    },
  });
