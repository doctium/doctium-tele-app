import { Injectable, Logger } from "@nestjs/common";

export interface WeatherSnapshot {
  tempC: number;
  humidity: number; // relative humidity %
  windKph: number;
}

const TTL_MS = 3 * 3_600_000; // weather barely moves in 3h; spares the free API
const FETCH_TIMEOUT_MS = 8_000;

/**
 * SCD Phase 4 (live-weather upgrade): current conditions for the patient's
 * location, used by the crisis-risk engine. Uses Open-Meteo — free, keyless —
 * so it works with zero configuration; set WEATHER_ENABLED=false to disable.
 *
 * No-op-safe: any missing coords / network failure / disable returns null, and
 * the risk engine falls back to its harmattan-season calendar heuristic.
 * Results are cached per ~1km tile so the daily sweep doesn't hammer the API.
 */
@Injectable()
export class WeatherProvider {
  private readonly logger = new Logger("Weather");
  private readonly cache = new Map<
    string,
    { at: number; data: WeatherSnapshot | null }
  >();

  get enabled(): boolean {
    return process.env.WEATHER_ENABLED !== "false";
  }

  /** Current conditions for a lat/lon pair (stored as strings on User). null when unavailable. */
  async current(
    latitude?: string | null,
    longitude?: string | null,
  ): Promise<WeatherSnapshot | null> {
    if (!this.enabled) return null;
    const lat = Number(latitude);
    const lon = Number(longitude);
    // "" → NaN; unset coords default to 0/0 (null island) — treat as unknown.
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      (lat === 0 && lon === 0) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return null;
    }

    // 2-decimal tile (~1.1km) — neighbours share a cache entry.
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

    const data = await this.fetchCurrent(lat, lon);
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }

  private async fetchCurrent(
    lat: number,
    lon: number,
  ): Promise<WeatherSnapshot | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=kmh`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          wind_speed_10m?: number;
        };
      };
      const c = json.current;
      if (!c || typeof c.temperature_2m !== "number") return null;
      return {
        tempC: c.temperature_2m,
        humidity:
          typeof c.relative_humidity_2m === "number"
            ? c.relative_humidity_2m
            : 50,
        windKph: typeof c.wind_speed_10m === "number" ? c.wind_speed_10m : 0,
      };
    } catch {
      // Network/timeout/parse — silent; the engine degrades to the calendar rule.
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
