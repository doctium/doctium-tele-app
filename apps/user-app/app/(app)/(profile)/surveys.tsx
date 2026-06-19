import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Space,
  Type,
  useColors,
  useThemedStyles,
} from "../../../src/theme";
import { Avatar } from "../../../src/components/common/Avatar";
import { Button } from "../../../src/components/common/Button";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { AnimatedPressable, AppHeader } from "../../../src/components/ui";
import { satisfactionApi } from "../../../src/api/satisfaction.api";

interface SurveyDoctor {
  name: string;
  image: string;
  designation: string;
}
interface Survey {
  id: string;
  status: string;
  npsScore: number | null;
  comment: string;
  doctor: SurveyDoctor;
  appointment: { date: string; time: string } | null;
}
interface Category {
  key: string;
  label: string;
}

export default function SurveysScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState<Survey[]>([]);
  const [completed, setCompleted] = useState<Survey[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Active form state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [catScores, setCatScores] = useState<Record<string, number>>({});
  const [bookAgain, setBookAgain] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    satisfactionApi
      .getMine()
      .then((r: unknown) => {
        const d = (
          r as {
            data: {
              open: Survey[];
              completed: Survey[];
              categories: Category[];
            };
          }
        ).data;
        setOpen(d.open ?? []);
        setCompleted(d.completed ?? []);
        setCategories(d.categories ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const startSurvey = (id: string) => {
    setActiveId(id === activeId ? null : id);
    setNps(null);
    setCatScores({});
    setBookAgain(null);
    setComment("");
  };

  const submit = async () => {
    if (activeId == null || nps == null) return;
    setSubmitting(true);
    try {
      await satisfactionApi.respond(activeId, {
        npsScore: nps,
        categories: catScores,
        comment: comment.trim() || undefined,
        wouldBookAgain: bookAgain ?? undefined,
      });
      setActiveId(null);
      load();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const visitDate = (s: Survey) =>
    s.appointment?.date
      ? new Date(`${s.appointment.date}T00:00:00`).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
        })
      : "";

  return (
    <View style={styles.root}>
      <AppHeader title={t("surveys.title")} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navyMid} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {open.length === 0 && completed.length === 0 ? (
            <View style={{ marginTop: 30 }}>
              <EmptyState
                icon="happy-outline"
                title={t("surveys.emptyTitle")}
                description={t("surveys.emptyDesc")}
              />
            </View>
          ) : null}

          {open.length > 0 ? (
            <Text style={styles.sectionTitle}>
              {t("surveys.waitingSection")}
            </Text>
          ) : null}
          {open.map((s) => {
            const isActive = s.id === activeId;
            return (
              <View key={s.id} style={styles.card}>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => startSurvey(s.id)}
                  style={styles.cardHead}
                >
                  <Avatar uri={s.doctor.image} name={s.doctor.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>
                      {t("surveys.doctorName", { name: s.doctor.name })}
                    </Text>
                    <Text style={styles.docMeta}>
                      {s.doctor.designation || t("surveys.consultation")} ·{" "}
                      {visitDate(s)}
                    </Text>
                  </View>
                  <View style={styles.rateChip}>
                    <Text style={styles.rateChipText}>
                      {isActive ? t("surveys.close") : t("surveys.rateNow")}
                    </Text>
                  </View>
                </AnimatedPressable>

                {isActive ? (
                  <View style={styles.form}>
                    {/* NPS 0–10 */}
                    <Text style={styles.q}>{t("surveys.npsQuestion")}</Text>
                    <View style={styles.npsRow}>
                      {Array.from({ length: 11 }, (_, n) => (
                        <AnimatedPressable
                          key={n}
                          haptic="light"
                          onPress={() => setNps(n)}
                          style={[
                            styles.npsCell,
                            nps === n && styles.npsCellSel,
                            nps === n &&
                              n <= 6 && { backgroundColor: colors.error },
                            nps === n &&
                              n >= 7 &&
                              n <= 8 && { backgroundColor: colors.warning },
                          ]}
                        >
                          <Text
                            style={[
                              styles.npsCellText,
                              nps === n && { color: "#fff" },
                            ]}
                          >
                            {n}
                          </Text>
                        </AnimatedPressable>
                      ))}
                    </View>
                    <View style={styles.npsLegend}>
                      <Text style={styles.npsLegendText}>
                        {t("surveys.npsLow")}
                      </Text>
                      <Text style={styles.npsLegendText}>
                        {t("surveys.npsHigh")}
                      </Text>
                    </View>

                    {/* Category stars */}
                    {categories.map((c) => (
                      <View key={c.key} style={styles.catRow}>
                        <Text style={styles.catLabel}>{c.label}</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <AnimatedPressable
                              key={v}
                              haptic="light"
                              onPress={() =>
                                setCatScores((p) => ({ ...p, [c.key]: v }))
                              }
                            >
                              <Ionicons
                                name={
                                  (catScores[c.key] ?? 0) >= v
                                    ? "star"
                                    : "star-outline"
                                }
                                size={22}
                                color={
                                  (catScores[c.key] ?? 0) >= v
                                    ? colors.warning
                                    : colors.border
                                }
                              />
                            </AnimatedPressable>
                          ))}
                        </View>
                      </View>
                    ))}

                    {/* Would book again */}
                    <Text style={styles.q}>
                      {t("surveys.bookAgainQuestion")}
                    </Text>
                    <View style={styles.bookRow}>
                      {[
                        {
                          v: true,
                          label: t("surveys.yes"),
                          icon: "thumbs-up" as const,
                        },
                        {
                          v: false,
                          label: t("surveys.no"),
                          icon: "thumbs-down" as const,
                        },
                      ].map((o) => (
                        <AnimatedPressable
                          key={o.label}
                          haptic="light"
                          onPress={() => setBookAgain(o.v)}
                          style={[
                            styles.bookBtn,
                            bookAgain === o.v && styles.bookBtnSel,
                          ]}
                        >
                          <Ionicons
                            name={o.icon}
                            size={16}
                            color={bookAgain === o.v ? "#fff" : colors.navyMid}
                          />
                          <Text
                            style={[
                              styles.bookText,
                              bookAgain === o.v && { color: "#fff" },
                            ]}
                          >
                            {o.label}
                          </Text>
                        </AnimatedPressable>
                      ))}
                    </View>

                    <TextInput
                      style={styles.commentInput}
                      placeholder={t("surveys.commentPlaceholder")}
                      placeholderTextColor={colors.text.tertiary}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      maxLength={1000}
                    />
                    <Button
                      label={t("surveys.sendFeedback")}
                      onPress={submit}
                      loading={submitting}
                      disabled={nps == null}
                      style={{ marginTop: 4 }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}

          {completed.length > 0 ? (
            <Text style={styles.sectionTitle}>
              {t("surveys.answeredSection")}
            </Text>
          ) : null}
          {completed.map((s) => (
            <View key={s.id} style={[styles.card, styles.cardDone]}>
              <View style={styles.cardHead}>
                <Avatar uri={s.doctor.image} name={s.doctor.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>
                    {t("surveys.doctorName", { name: s.doctor.name })}
                  </Text>
                  <Text style={styles.docMeta}>
                    {visitDate(s)}
                    {s.comment
                      ? ` · "${s.comment.slice(0, 40)}${s.comment.length > 40 ? "…" : ""}"`
                      : ""}
                  </Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeText}>{s.npsScore}/10</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: Space.xl, paddingBottom: 40 },
    sectionTitle: {
      ...Type.overline,
      color: c.text.tertiary,
      marginTop: 18,
      marginBottom: 10,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      ...Shadow.card,
    },
    cardDone: { opacity: 0.92 },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    docName: {
      ...Type.bodyMed,
      fontFamily: Fonts.bold,
      color: c.text.primary,
    },
    docMeta: { ...Type.caption, color: c.text.tertiary, marginTop: 2 },
    rateChip: {
      backgroundColor: c.navy,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.round,
    },
    rateChipText: { fontFamily: Fonts.bold, fontSize: 12.5, color: "#fff" },
    scoreBadge: {
      backgroundColor: "rgba(44,183,167,0.12)",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.round,
    },
    scoreBadgeText: { fontFamily: Fonts.bold, fontSize: 13, color: c.teal },

    form: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    q: {
      ...Type.bodySm,
      fontFamily: Fonts.semibold,
      color: c.text.primary,
      marginBottom: 10,
    },
    npsRow: { flexDirection: "row", gap: 4 },
    npsCell: {
      flex: 1,
      height: 36,
      borderRadius: 8,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    npsCellSel: { backgroundColor: c.teal, borderColor: "transparent" },
    npsCellText: {
      fontFamily: Fonts.bold,
      fontSize: 12.5,
      color: c.text.secondary,
    },
    npsLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
      marginBottom: 14,
    },
    npsLegendText: {
      ...Type.caption,
      fontSize: 10.5,
      color: c.text.tertiary,
    },

    catRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    catLabel: { ...Type.bodySm, color: c.text.primary },
    starsRow: { flexDirection: "row", gap: 6 },

    bookRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    bookBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 11,
      borderRadius: Radius.lg,
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    bookBtnSel: { backgroundColor: c.navy, borderColor: "transparent" },
    bookText: { fontFamily: Fonts.bold, fontSize: 13.5, color: c.navyMid },

    commentInput: {
      backgroundColor: c.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      minHeight: 80,
      fontFamily: Fonts.medium,
      fontSize: 14,
      color: c.text.primary,
      textAlignVertical: "top",
      marginBottom: 12,
    },
  });
