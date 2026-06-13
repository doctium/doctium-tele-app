import { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { store } from "../src/store";
import { FontMap, ThemeProvider, useTheme, useThemeReady } from "../src/theme";

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

// Inner shell — under ThemeProvider so the StatusBar + nav background follow
// the live theme.
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
  const themeReady = useThemeReady();
  // Hold the splash until fonts AND the saved theme are applied (no light flash).
  const ready = (loaded || error) && themeReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <ThemedShell />
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds the error boundary + native crash context (passthrough when uninit).
export default Sentry.wrap(RootLayout);
