import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Button } from "../../../src/components/common/Button";
import { Input } from "../../../src/components/common/Input";
import { AppHeader, Card, Txt } from "../../../src/components/ui";
import { doctorApi } from "../../../src/api/doctor.api";
import {
  formatMoney,
  toStoredAmount,
  toMajorUnits,
} from "../../../src/utils/money";

export default function PricingScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [scheduled, setScheduled] = useState("");
  const [instantDay, setInstantDay] = useState("");
  const [instantNight, setInstantNight] = useState("");
  const [currency, setCurrency] = useState("₦");
  const [discountActive, setDiscountActive] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountLabel, setDiscountLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    doctorApi
      .getProfile()
      .then((r: unknown) => {
        const d = (
          r as {
            data?: {
              scheduledFee?: number;
              instantDayFee?: number;
              instantNightFee?: number;
              charge?: number;
              discountActive?: boolean;
              discountPercent?: number;
              discountLabel?: string;
            };
          }
        ).data;
        if (!d) return;
        // Stored as kobo → show major units in the naira input fields.
        const sched = d.scheduledFee || d.charge || 0;
        setScheduled(sched ? String(toMajorUnits(sched)) : "");
        setInstantDay(
          d.instantDayFee ? String(toMajorUnits(d.instantDayFee)) : "",
        );
        setInstantNight(
          d.instantNightFee ? String(toMajorUnits(d.instantNightFee)) : "",
        );
        setDiscountActive(!!d.discountActive);
        setDiscountPercent(d.discountPercent ? String(d.discountPercent) : "");
        setDiscountLabel(d.discountLabel || "");
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await doctorApi.updatePricing({
        scheduledFee: toStoredAmount(parseFloat(scheduled) || 0),
        instantDayFee: toStoredAmount(parseFloat(instantDay) || 0),
        instantNightFee: toStoredAmount(parseFloat(instantNight) || 0),
        discountActive,
        discountPercent: parseFloat(discountPercent) || 0,
        discountLabel: discountLabel.trim(),
      });
      setSaved(true);
    } catch {
      /* surfaced elsewhere */
    } finally {
      setLoading(false);
    }
  };

  const num = (v: string, set: (s: string) => void) => (t: string) => {
    set(t.replace(/[^0-9.]/g, ""));
    setSaved(false);
  };

  const pct = Math.min(parseFloat(discountPercent) || 0, 100);
  // Preview works in kobo (stored units) so formatMoney renders it correctly.
  const orig = toStoredAmount(parseFloat(scheduled) || 0);
  const sale = pct > 0 ? Math.round(orig * (1 - pct / 100)) : orig;
  const showPreview = discountActive && pct > 0 && orig > 0;

  return (
    <View style={styles.root}>
      <AppHeader title="Consultation fees" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Set what patients pay you per consultation. Doctium deducts its
          commission automatically; the rest is credited to your wallet when an
          appointment is completed.
        </Text>

        <Card style={styles.card}>
          <View style={styles.rowHead}>
            <Ionicons name="calendar-outline" size={18} color={colors.navy} />
            <Txt variant="h3">Scheduled</Txt>
          </View>
          <Text style={styles.hint}>
            A patient books a future date &amp; time.
          </Text>
          <Input
            label={`Fee (${currency})`}
            placeholder="e.g. 5000"
            value={scheduled}
            onChangeText={num(scheduled, setScheduled)}
            keyboardType="number-pad"
            containerStyle={{ marginBottom: 0, marginTop: 10 }}
          />
        </Card>

        <Card style={styles.card}>
          <View style={styles.rowHead}>
            <Ionicons name="flash-outline" size={18} color={colors.teal} />
            <Txt variant="h3">Instant (emergency)</Txt>
          </View>
          <Text style={styles.hint}>
            A patient consults you right now while you&apos;re online. Night
            rate applies during the platform&apos;s night window.
          </Text>
          <View style={styles.row}>
            <Input
              label={`Day fee (${currency})`}
              placeholder="e.g. 8000"
              value={instantDay}
              onChangeText={num(instantDay, setInstantDay)}
              keyboardType="number-pad"
              containerStyle={styles.half}
            />
            <Input
              label={`Night fee (${currency})`}
              placeholder="e.g. 12000"
              value={instantNight}
              onChangeText={num(instantNight, setInstantNight)}
              keyboardType="number-pad"
              containerStyle={styles.half}
            />
          </View>
        </Card>

        {/* Promotion */}
        <Card style={styles.card}>
          <View style={styles.promoHead}>
            <View style={styles.rowHead}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color={colors.warning}
              />
              <Txt variant="h3">Run a promotion</Txt>
            </View>
            <Switch
              value={discountActive}
              onValueChange={(v) => {
                setDiscountActive(v);
                setSaved(false);
              }}
              trackColor={{ false: colors.border, true: colors.teal }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.hint}>
            Take a % off all your consult fees. Your prices above stay the
            &quot;original&quot; — patients see them struck through with your
            sale price.
          </Text>
          {discountActive ? (
            <>
              <View style={styles.row}>
                <Input
                  label="Discount %"
                  placeholder="e.g. 20"
                  value={discountPercent}
                  onChangeText={num(discountPercent, setDiscountPercent)}
                  keyboardType="number-pad"
                  containerStyle={styles.half}
                />
                <Input
                  label="Label (optional)"
                  placeholder="e.g. New-patient offer"
                  value={discountLabel}
                  onChangeText={(t) => {
                    setDiscountLabel(t);
                    setSaved(false);
                  }}
                  containerStyle={styles.half}
                />
              </View>
              {showPreview ? (
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>Patients pay</Text>
                  <View style={styles.previewPrices}>
                    <Text style={styles.previewWas}>{formatMoney(orig)}</Text>
                    <Text style={styles.previewNow}>{formatMoney(sale)}</Text>
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeTxt}>{pct}% OFF</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </Card>

        <Button
          label={saved ? "Saved ✓" : "Save fees"}
          onPress={save}
          loading={loading}
          icon={<Ionicons name="save-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 44 },
    intro: {
      ...Type.bodySm,
      color: c.text.secondary,
      lineHeight: 19,
      marginBottom: 16,
    },
    card: { marginBottom: 14 },
    rowHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    promoHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    hint: { ...Type.caption, color: c.text.tertiary, lineHeight: 17 },
    row: { flexDirection: "row", gap: 12, marginTop: 10 },
    half: { flex: 1, marginBottom: 0 },
    preview: {
      marginTop: 14,
      padding: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.warningSoft,
    },
    previewLabel: {
      ...Type.caption,
      color: c.text.secondary,
      marginBottom: 4,
    },
    previewPrices: { flexDirection: "row", alignItems: "center", gap: 10 },
    previewWas: {
      ...Type.body,
      color: c.text.tertiary,
      textDecorationLine: "line-through",
    },
    previewNow: {
      fontFamily: Fonts.extrabold,
      fontSize: 20,
      color: c.navy,
      letterSpacing: -0.4,
    },
    previewBadge: {
      backgroundColor: c.warning,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.sm,
    },
    previewBadgeTxt: {
      fontFamily: Fonts.bold,
      fontSize: 11,
      color: "#fff",
      letterSpacing: 0.3,
    },
  });
