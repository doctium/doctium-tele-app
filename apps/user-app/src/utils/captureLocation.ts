import * as Location from 'expo-location';
import { usersApi } from '../api/users.api';

let attempted = false;

/**
 * One-shot: if we don't already know the user's country, ask for location,
 * reverse-geocode to an ISO country code, and save it on their profile.
 * Silent on denial/error — discovery falls back to manual region selection.
 */
export async function captureLocationOnce(knownCountry?: string): Promise<void> {
  if (attempted || knownCountry) return;
  attempted = true;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    await usersApi.updateProfile({
      country: geo?.isoCountryCode ?? '',
      latitude: String(pos.coords.latitude),
      longitude: String(pos.coords.longitude),
    });
  } catch {
    /* ignore — non-blocking */
  }
}
