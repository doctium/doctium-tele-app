import { useEffect } from "react";
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import { apiClient } from "../api/client";

/**
 * Registers this doctor device's FCM push token with the API so admin broadcasts can reach it.
 * No-ops gracefully in Expo Go or when the native push module / Firebase config is absent.
 * Full OS push needs a dev/standalone build + FIREBASE_* creds.
 */
export function usePushNotifications() {
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isRunningInExpoGo()) return;

        const Notifications = await import("expo-notifications");
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        let granted = (await Notifications.getPermissionsAsync()).granted;
        if (!granted)
          granted = (await Notifications.requestPermissionsAsync()).granted;
        if (!granted) return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
        }

        const { data } = await Notifications.getDevicePushTokenAsync();
        const token = typeof data === "string" ? data : String(data);
        if (mounted && token)
          await apiClient.patch("/doctors/me/fcm-token", { fcmToken: token });
      } catch {
        // Expo Go / no native push module / no Firebase config -> silently skip.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
}
