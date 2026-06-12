import { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";
import { store } from "../src/store";
import { FontMap, ThemeProvider, useTheme, useThemeReady } from "../src/theme";
import i18n, { useI18nReady } from "../src/i18n";

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

export default function RootLayout() {
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
