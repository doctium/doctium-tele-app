import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppHeader, Txt } from "../ui";
import { Palette, Space, useColors, useThemedStyles } from "../../theme";
import type { LegalBlock } from "../../content/legal";

/** Renders a parsed legal document (Terms / Privacy) — themed, scrollable. */
export function LegalScreen({
  title,
  blocks,
}: {
  title: string;
  blocks: LegalBlock[];
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      <AppHeader title={title} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {blocks.map((b, i) => {
          if (b.h === 1)
            return (
              <Txt
                key={i}
                variant="h2"
                color={colors.text.primary}
                style={styles.docTitle}
              >
                {b.text}
              </Txt>
            );
          if (b.h === 2)
            return (
              <Txt
                key={i}
                variant="h3"
                color={colors.text.primary}
                style={styles.section}
              >
                {b.text}
              </Txt>
            );
          return (
            <Txt
              key={i}
              variant="body"
              color={colors.text.secondary}
              style={styles.para}
            >
              {b.text}
            </Txt>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: Space.xxl, paddingTop: 4, paddingBottom: 60 },
    docTitle: { marginBottom: 6 },
    section: { marginTop: 22, marginBottom: 8 },
    para: { marginBottom: 12, lineHeight: 22 },
  });
