import "server-only";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  miles: number;
  source: "google" | "osm";
}

export class DistanceError extends Error {}

const METERS_PER_MILE = 1609.344;
/** Straight-line → road distance factor used by the OpenStreetMap fallback. */
const ROAD_FACTOR = 1.3;

const geocodeCache = new Map<string, LatLng>();

function googleServerKey(): string {
  return process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function googleDistance(origin: string, destination: string, key: string): Promise<number> {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("key", key);
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    throw new DistanceError("Distance service is unreachable.");
  }
  if (!res.ok) throw new DistanceError(`Distance service returned ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    rows?: { elements?: { status: string; distance?: { value: number } }[] }[];
  };
  const element = data.rows?.[0]?.elements?.[0];
  if (data.status !== "OK" || !element || element.status !== "OK" || !element.distance) {
    throw new DistanceError("We couldn't find a driving route between those addresses.");
  }
  return element.distance.value / METERS_PER_MILE;
}

export async function geocodeOSM(address: string): Promise<LatLng> {
  const key = address.trim().toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("q", address);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "airport-transfer-app/1.0 (booking quote)", "Accept-Language": "en" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new DistanceError("Address lookup is unavailable right now. Choose a city zone instead, or call us for a quote.");
  }
  if (!res.ok) throw new DistanceError("Address lookup is unavailable right now. Choose a city zone instead.");
  const results = (await res.json()) as { lat: string; lon: string }[];
  const first = results[0];
  if (!first) throw new DistanceError(`We couldn't find "${address}". Check the address or choose a city zone.`);
  const point = { lat: Number(first.lat), lng: Number(first.lon) };
  geocodeCache.set(key, point);
  return point;
}

/**
 * Driving distance in miles between two places. Each end may be a free-text address
 * or known coordinates (used for configured airports/stations).
 * Uses Google Distance Matrix when a key is set, otherwise OpenStreetMap geocoding
 * with a road-distance factor.
 */
export async function getDrivingDistanceMiles(
  origin: string | LatLng,
  destination: string | LatLng,
): Promise<DistanceResult> {
  const key = googleServerKey();
  const asText = (p: string | LatLng) => (typeof p === "string" ? p : `${p.lat},${p.lng}`);

  if (key) {
    try {
      const miles = await googleDistance(asText(origin), asText(destination), key);
      return { miles: Math.round(miles * 10) / 10, source: "google" };
    } catch (err) {
      // Fall through to OSM if Google is misconfigured (e.g. referrer-restricted key).
      console.warn("[distance] Google Distance Matrix failed, using OpenStreetMap fallback:", (err as Error).message);
    }
  }

  const [a, b] = await Promise.all([
    typeof origin === "string" ? geocodeOSM(origin) : Promise.resolve(origin),
    typeof destination === "string" ? geocodeOSM(destination) : Promise.resolve(destination),
  ]);
  const miles = haversineMiles(a, b) * ROAD_FACTOR;
  return { miles: Math.max(1, Math.round(miles * 10) / 10), source: "osm" };
}
