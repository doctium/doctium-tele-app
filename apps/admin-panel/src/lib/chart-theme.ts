"use client";
import { useTheme } from "@/lib/theme-context";

/**
 * Recharts can't read CSS variables, so chart chrome (gridlines, axes, tooltip)
 * is resolved to concrete colors from the live theme. Bar/area FILLS stay brand
 * colors (they read on both surfaces); only the chrome flips.
 */
export function useChartTheme() {
  const { isDark } = useTheme();
  return {
    grid: isDark ? "#22324A" : "#EEF2F7",
    axisTick: isDark ? "#8090A6" : "#9CA3AF",
    axisLine: isDark ? "#2A3A52" : "#EEF2F7",
    cursorFill: isDark ? "rgba(255,255,255,0.04)" : "rgba(44,183,167,0.06)",
    dotStroke: isDark ? "#16243B" : "#fff",
    tooltipContentStyle: {
      borderRadius: 14,
      border: `1px solid ${isDark ? "#2A3A52" : "#EEF2F7"}`,
      background: isDark ? "#16243B" : "#fff",
      boxShadow: isDark
        ? "0 18px 40px -18px rgba(0,0,0,0.55)"
        : "0 18px 40px -18px rgba(19,49,87,0.28)",
      fontSize: 12,
      fontWeight: 500,
      padding: "10px 14px",
    } as const,
    tooltipLabelStyle: {
      color: isDark ? "#EDF2F8" : "#133157",
      fontWeight: 700,
      marginBottom: 4,
    } as const,
    tooltipItemStyle: { color: isDark ? "#9FB0C6" : "#475569" } as const,
  };
}
