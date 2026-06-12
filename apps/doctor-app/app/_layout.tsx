import { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { store } from "../src/store";
import { FontMap, ThemeProvider, useTheme, useThemeReady } from "../src/theme";

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

export default function RootLayout() {
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
