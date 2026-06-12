"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
const KEY = "admin-theme";

/**
 * Inline script (no-flash): runs before paint to set the `dark` class on <html>
 * from the saved preference (or the OS), so there's no light-mode flicker.
 * Injected verbatim in the root layout <head>.
 */
export const themeNoFlashScript = `(function(){try{var m=localStorage.getItem('${KEY}')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function resolve(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

interface ThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
}
const Ctx = createContext<ThemeCtx>({
  mode: "system",
  isDark: false,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isDark, setIsDark] = useState(false);

  // Hydrate from storage (the no-flash script already applied the class).
  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as ThemeMode) || "system";
    setModeState(saved);
    setIsDark(resolve(saved));
  }, []);

  // Follow the OS while in "system" mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => {
      setIsDark(mq.matches);
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(KEY, m);
    setModeState(m);
    const d = resolve(m);
    setIsDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);

  return (
    <Ctx.Provider value={{ mode, isDark, setMode }}>{children}</Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
