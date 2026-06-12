import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Space,
  Type,
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

interface Region {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
}

export default function RegionScreen() {
  const styles = useThemedStyles(makeStyles);
  const [regions, setRegions] = useState<Region[]>([]);
  const [practice, setPractice] = useState("");
  const [nationality, setNationality] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    doctorApi
      .getRegions()
      .then((r: unknown) => setRegions((r as { data: Region[] }).data ?? []))
      .catch(() => {});
    doctorApi
      .getProfile()
      .then((r: unknown) => {
        const d = (
          r as { data?: { practiceCountry?: string; nationality?: string } }
        ).data;
        if (d?.practiceCountry) setPractice(d.practiceCountry);
        if (d?.nationality) setNationality(d.nationality);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await doctorApi.updateRegion({
        practiceCountry: practice || undefined,
        nationality: nationality || undefined,
      });
      setSaved(true);
    } catch {
      /* surfaced elsewhere */
    } finally {
      setLoading(false);
    }
  };

  const cur = regions.find((r) => r.code === practice);

  return (
    <View style={styles.root}>
      <AppHeader title="Practice & region" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <Txt variant="h3" style={{ marginBottom: 4 }}>
            Where do you practise?
          </Txt>
          <Text style={styles.hint}>
            This sets the currency your fees are charged in and helps patients
            in your region find you.
          </Text>
          <View style={styles.grid}>
            {regions.map((r) => (
              <Pill
                key={r.code}
                active={practice === r.code}
                label={`${r.name}`}
                onPress={() => {
                  setPractice(r.code);
                  setSaved(false);
                }}
              />
            ))}
          </View>
          {cur ? (
            <Text style={styles.currencyNote}>
              Fees will be charged in {cur.currencyCode} ({cur.currencySymbol}).
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Txt variant="h3" style={{ marginBottom: 4 }}>
            Nationality
          </Txt>
          <Text style={styles.hint}>
            Helps patients abroad find a doctor from their home country (e.g.
            diaspora).
          </Text>
          <View style={styles.grid}>
            {regions.map((r) => (
              <Pill
                key={r.code}
                active={nationality === r.code}
                label={r.name}
                onPress={() => {
                  setNationality(r.code);
                  setSaved(false);
                }}
              />
            ))}
          </View>
        </Card>

        <Button
          label={saved ? "Saved ✓" : "Save"}
          onPress={save}
          loading={loading}
          icon={<Ionicons name="save-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </View>
  );
}

function Pill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <AnimatedPressable
      haptic="light"
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 44 },
    card: { marginBottom: 14 },
    hint: {
      ...Type.caption,
      color: c.text.tertiary,
      lineHeight: 17,
      marginBottom: 12,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.round,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    pillActive: { backgroundColor: c.navy, borderColor: c.navy },
    pillTxt: { ...Type.label, color: c.text.secondary },
    pillTxtActive: { color: "#fff" },
    currencyNote: {
      ...Type.caption,
      color: c.tealDeep,
      marginTop: 12,
      fontFamily: Fonts.semibold,
    },
  });
