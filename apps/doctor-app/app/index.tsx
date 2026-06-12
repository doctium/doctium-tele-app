import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "../src/theme";

export default function Index() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("doctorAccessToken").then((t) => {
      setHasToken(!!t);
      setLoading(false);
    });
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
  return <Redirect href={hasToken ? "/(app)/(dashboard)" : "/(auth)/login"} />;
}
