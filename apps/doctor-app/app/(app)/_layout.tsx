import { Tabs } from "expo-router";
import { FloatingTabBar } from "../../src/components/ui";
import { usePushNotifications } from "../../src/hooks/usePushNotifications";

export default function AppLayout() {
  usePushNotifications();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#F4F7FB" },
      }}
    >
      <Tabs.Screen name="(dashboard)" />
      <Tabs.Screen name="(appointments)" />
      <Tabs.Screen name="(schedule)" />
      <Tabs.Screen name="(chat)" />
      <Tabs.Screen name="(profile)" />
      <Tabs.Screen name="(earnings)" options={{ href: null }} />
      <Tabs.Screen name="(videos)" options={{ href: null }} />
      <Tabs.Screen name="(prescriptions)" options={{ href: null }} />
      <Tabs.Screen name="(subscription)" options={{ href: null }} />
      <Tabs.Screen name="(verification)" options={{ href: null }} />
      <Tabs.Screen name="(emr)" options={{ href: null }} />
      <Tabs.Screen name="(referrals)" options={{ href: null }} />
    </Tabs>
  );
}
