import "server-only";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  miles: number;
  source: "google" | "geoapify" | "osm";
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

function toWaypoint(p: string | LatLng) {
  return typeof p === "string"
    ? { waypoint: { address: p } }
    : { waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } };
}

/** Google Routes API (computeRouteMatrix) — the current replacement for the legacy Distance Matrix API. */
async function googleDistance(origin: string | LatLng, destination: string | LatLng, key: string): Promise<number> {
  let res: Response;
  try {
    res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: [toWaypoint(origin)],
        destinations: [toWaypoint(destination)],
        travelMode: "DRIVE",
        units: "IMPERIAL",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new DistanceError("Distance service is unreachable.");
  }
  if (!res.ok) throw new DistanceError(`Distance service returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { distanceMeters?: number; condition?: string }[];
  const element = Array.isArray(data) ? data[0] : undefined;
  if (!element || element.condition !== "ROUTE_EXISTS" || typeof element.distanceMeters !== "number") {
    throw new DistanceError("We couldn't find a driving route between those addresses.");
  }
  return element.distanceMeters / METERS_PER_MILE;
}

/**
 * Geoapify API key. Also accepts a full Geoapify request URL pasted by mistake
 * (e.g. the "sample request" from the dashboard) and extracts its apiKey parameter.
 */
export function geoapifyKey(raw: string | undefined = process.env.GEOAPIFY_API_KEY): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).searchParams.get("apiKey")?.trim() ?? "";
    } catch {
      return "";
    }
  }
  return value;
}

async function geoapifyFetch<T>(url: URL): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    throw new DistanceError("Address lookup is unavailable right now. Choose a city zone instead, or call us for a quote.");
  }
  if (!res.ok) throw new DistanceError(`Address service returned ${res.status}`);
  return (await res.json()) as T;
}

/** Geoapify geocoding (free plan: 3,000 credits/day, no card). */
async function geocodeGeoapify(address: string, key: string): Promise<LatLng> {
  const cacheKey = `geoapify:${address.trim().toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", address);
  url.searchParams.set("filter", "countrycode:us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", key);
  const data = await geoapifyFetch<{ results?: { lat: number; lon: number }[] }>(url);
  const first = data.results?.[0];
  if (!first) throw new DistanceError(`We couldn't find "${address}". Check the address or choose a city zone.`);
  const point = { lat: first.lat, lng: first.lon };
  geocodeCache.set(cacheKey, point);
  return point;
}

/** Geoapify driving route distance in miles. */
async function geoapifyDistance(origin: string | LatLng, destination: string | LatLng, key: string): Promise<number> {
  const [a, b] = await Promise.all([
    typeof origin === "string" ? geocodeGeoapify(origin, key) : Promise.resolve(origin),
    typeof destination === "string" ? geocodeGeoapify(destination, key) : Promise.resolve(destination),
  ]);
  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set("waypoints", `${a.lat},${a.lng}|${b.lat},${b.lng}`);
  url.searchParams.set("mode", "drive");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", key);
  const data = await geoapifyFetch<{ results?: { distance?: number }[] }>(url);
  const meters = data.results?.[0]?.distance;
  if (typeof meters !== "number") throw new DistanceError("We couldn't find a driving route between those addresses.");
  return meters / METERS_PER_MILE;
}

export interface AddressSuggestion {
  id: string;
  text: string;
}

/** Address autocomplete via Geoapify, biased to the service area. Returns null when not configured. */
export async function suggestAddresses(text: string, near: LatLng): Promise<AddressSuggestion[] | null> {
  const key = geoapifyKey();
  if (!key) return null;
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", text);
  url.searchParams.set("filter", "countrycode:us");
  url.searchParams.set("bias", `proximity:${near.lng},${near.lat}`);
  url.searchParams.set("limit", "5");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", key);
  const data = await geoapifyFetch<{ results?: { place_id?: string; formatted?: string }[] }>(url);
  return (data.results ?? [])
    .filter((r) => r.formatted)
    .map((r, i) => ({ id: r.place_id ?? String(i), text: r.formatted! }));
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
 * Provider order: Google Routes API (GOOGLE key) → Geoapify (free, GEOAPIFY_API_KEY) → otherwise OpenStreetMap geocoding
 * with a road-distance factor.
 */
export async function getDrivingDistanceMiles(
  origin: string | LatLng,
  destination: string | LatLng,
): Promise<DistanceResult> {
  const key = googleServerKey();
  if (key) {
    try {
      const miles = await googleDistance(origin, destination, key);
      return { miles: Math.round(miles * 10) / 10, source: "google" };
    } catch (err) {
      // Fall through to OSM if Google is misconfigured (e.g. referrer-restricted key or API not enabled).
      console.warn("[distance] Google Routes API failed, using OpenStreetMap fallback:", (err as Error).message);
    }
  }

  const geoKey = geoapifyKey();
  if (geoKey) {
    try {
      const miles = await geoapifyDistance(origin, destination, geoKey);
      return { miles: Math.round(miles * 10) / 10, source: "geoapify" };
    } catch (err) {
      if (err instanceof DistanceError && /couldn't find/.test(err.message)) throw err;
      console.warn("[distance] Geoapify failed, using OpenStreetMap fallback:", (err as Error).message);
    }
  }

  const [a, b] = await Promise.all([
    typeof origin === "string" ? geocodeOSM(origin) : Promise.resolve(origin),
    typeof destination === "string" ? geocodeOSM(destination) : Promise.resolve(destination),
  ]);
  const miles = haversineMiles(a, b) * ROAD_FACTOR;
  return { miles: Math.max(1, Math.round(miles * 10) / 10), source: "osm" };
}
