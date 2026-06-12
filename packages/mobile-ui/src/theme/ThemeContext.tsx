import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { DarkColors, LightColors, Palette } from "./colors";

export type ThemeMode = "system" | "light" | "dark";
export type Scheme = "light" | "dark";

const STORAGE_KEY = "doctium.theme";

// Cached at bootstrap so the provider initializes synchronously (no flash).
let cachedMode: ThemeMode = "system";

/** Read the persisted theme mode. Call once before first paint (root gate). */
export async function bootstrapTheme(): Promise<void> {
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") cachedMode = v;
  } catch {
    // ignore — falls back to "system"
  }
}

/** Gate hook for the root layout: resolves once the saved mode is loaded. */
export function useThemeReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    bootstrapTheme().finally(() => setReady(true));
  }, []);
  return ready;
}

interface ThemeCtx {
  mode: ThemeMode; // user choice: system | light | dark
  scheme: Scheme; // resolved: light | dark
  colors: Palette;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: "system",
  scheme: "light",
  colors: LightColors,
  isDark: false,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(cachedMode);
  const [sysScheme, setSysScheme] = useState<Scheme>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  // Track OS appearance so "system" mode follows the device live.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSysScheme(colorScheme === "dark" ? "dark" : "light"),
    );
    return () => sub.remove();
  }, []);

  const scheme: Scheme = mode === "system" ? sysScheme : mode;
  const colors = scheme === "dark" ? DarkColors : LightColors;

  const setMode = useCallback((m: ThemeMode) => {
    cachedMode = m;
    setModeState(m);
    SecureStore.setItemAsync(STORAGE_KEY, m).catch(() => {});
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({ mode, scheme, colors, isDark: scheme === "dark", setMode }),
    [mode, scheme, colors, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Full theme context (mode/scheme/colors/setMode). */
export const useTheme = () => useContext(Ctx);

/** Just the live palette — the common case in screens/components. */
export const useColors = (): Palette => useContext(Ctx).colors;

/**
 * Themed StyleSheet: pass a factory `(c) => StyleSheet.create({...})` and get
 * a memoized sheet that rebuilds when the palette changes. The factory should
 * be a stable module-level function.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: Palette) => T,
): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
