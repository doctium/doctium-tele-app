import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";

const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

/** Downloads the authed prescription PDF to cache and opens the OS share/preview sheet. */
export async function openPrescriptionPdf(
  prescriptionId: string,
): Promise<void> {
  const token = await SecureStore.getItemAsync("accessToken");
  const url = `${API_ORIGIN}/api/v1/prescriptions/${prescriptionId}/pdf`;
  const target = `${FileSystem.cacheDirectory}prescription-${prescriptionId}.pdf`;
  const { uri } = await FileSystem.downloadAsync(url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Prescription",
    });
  }
}

/** Downloads the authed referral-letter PDF and opens the OS share/preview sheet. */
export async function openReferralPdf(referralId: string): Promise<void> {
  const token = await SecureStore.getItemAsync("accessToken");
  const url = `${API_ORIGIN}/api/v1/referrals/${referralId}/pdf`;
  const target = `${FileSystem.cacheDirectory}referral-${referralId}.pdf`;
  const { uri } = await FileSystem.downloadAsync(url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Referral letter",
    });
  }
}
