import { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import { store } from "../src/store";
import { FontMap, ThemeProvider, useTheme, useThemeReady } from "../src/theme";
import i18n, { useI18nReady } from "../src/i18n";

// Crash/error reporting — no-op unless EXPO_PUBLIC_SENTRY_DSN is set. Full native
// crash capture requires a dev/production build (not Expo Go).
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    sendDefaultPii: false,
  });
}

SplashScreen.preventAutoHideAsync();

// Inner shell — lives under ThemeProvider so the StatusBar + nav background
// follow the live theme.
function ThemedShell() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

function RootLayout() {
  const [loaded, error] = useFonts(FontMap);
  const i18nReady = useI18nReady();
  const themeReady = useThemeReady();
  // Hold the splash until fonts, the saved language AND the saved theme are
  // applied — so the first paint is already in the user's language + theme
  // (no English flash, no light-mode flash).
  const ready = (loaded || error) && i18nReady && themeReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <Provider store={store}>
            <ThemeProvider>
              <ThemedShell />
            </ThemeProvider>
          </Provider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds the error boundary + native crash context (passthrough when uninit).
export default Sentry.wrap(RootLayout);
