import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "../src/theme";
import { getOnboardingSeen } from "../src/utils/onboardingPrefs";

export default function Index() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    (async () => {
      const [token, seen] = await Promise.all([
        SecureStore.getItemAsync("accessToken"),
        getOnboardingSeen(),
      ]);
      setHasToken(!!token);
      setOnboarded(seen);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        }}
      >
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  // First-time users see onboarding before the auth/home split.
  const href = !onboarded
    ? "/(onboarding)"
    : hasToken
      ? "/(app)/(home)"
      : "/(auth)/login";
  return <Redirect href={href} />;
}
