import { useEffect } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { FloatingTabBar } from "../../src/components/ui";
import { LeenahFab } from "../../src/components/common/LeenahFab";
import { usePushNotifications } from "../../src/hooks/usePushNotifications";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { fetchFavoriteIds } from "../../src/store/slices/favoritesSlice";

export default function AppLayout() {
  usePushNotifications();
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchFavoriteIds());
  }, [dispatch]);
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "#F4F7FB" },
        }}
      >
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="(appointments)" />
        <Tabs.Screen name="(clips)" />
        <Tabs.Screen name="(chat)" />
        <Tabs.Screen name="(profile)" />
        <Tabs.Screen name="(doctors)" options={{ href: null }} />
        <Tabs.Screen name="(wallet)" options={{ href: null }} />
        <Tabs.Screen name="(prescriptions)" options={{ href: null }} />
        <Tabs.Screen name="(subscription)" options={{ href: null }} />
        <Tabs.Screen name="(support)" options={{ href: null }} />
        <Tabs.Screen name="(emr)" options={{ href: null }} />
      </Tabs>
      {/* Global hands-free Leenah launcher (hidden on the Leenah screen itself). */}
      <LeenahFab />
    </View>
  );
}
