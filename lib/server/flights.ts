import "server-only";
import { FLIGHT_ADJUST_THRESHOLD_MINUTES } from "../config";
import { serverEnv } from "../env";
import type { FlightStatusResult } from "../types";

interface AirLabsFlight {
  flight_iata?: string;
  status?: string;
  arr_iata?: string;
  arr_time_utc?: string;
  arr_estimated_utc?: string;
  arr_actual_utc?: string;
  arr_delayed?: number;
}

/** AirLabs returns "YYYY-MM-DD HH:mm" in UTC. */
function airlabsUtcToIso(value: string | undefined): string | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}:00Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function normaliseStatus(status: string | undefined, delayMinutes: number | null): FlightStatusResult["status"] {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled") return "cancelled";
  if (s === "landed") return "landed";
  if (s === "diverted") return "diverted";
  if (delayMinutes != null && delayMinutes > FLIGHT_ADJUST_THRESHOLD_MINUTES) return "delayed";
  if (s === "en-route" || s === "active") return "en-route";
  if (s === "scheduled") return "scheduled";
  return "unknown";
}

async function fetchAirLabs(flightNumber: string): Promise<FlightStatusResult> {
  const url = new URL("https://airlabs.co/api/v9/flight");
  url.searchParams.set("flight_iata", flightNumber);
  url.searchParams.set("api_key", process.env.AIRLABS_API_KEY!);
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`AirLabs returned ${res.status}`);
  const data = (await res.json()) as { response?: AirLabsFlight; error?: { message?: string } };
  if (data.error || !data.response) {
    return {
      flightNumber,
      status: "unknown",
      scheduledArrival: null,
      estimatedArrival: null,
      arrivalAirport: null,
      delayMinutes: null,
      simulated: false,
    };
  }
  const f = data.response;
  const scheduled = airlabsUtcToIso(f.arr_time_utc);
  const estimated = airlabsUtcToIso(f.arr_actual_utc) ?? airlabsUtcToIso(f.arr_estimated_utc) ?? scheduled;
  const delay =
    typeof f.arr_delayed === "number"
      ? f.arr_delayed
      : scheduled && estimated
        ? Math.round((Date.parse(estimated) - Date.parse(scheduled)) / 60_000)
        : null;
  return {
    flightNumber,
    status: normaliseStatus(f.status, delay),
    scheduledArrival: scheduled,
    estimatedArrival: estimated,
    arrivalAirport: f.arr_iata ?? null,
    delayMinutes: delay,
    simulated: false,
  };
}

/**
 * Deterministic simulated flight status for Demo Mode: the same flight number
 * always gets the same delay so the demo is repeatable. Flights ending in 0
 * are cancelled, which demonstrates the airline-cancellation refund policy.
 */
export function simulateFlight(flightNumber: string, scheduledArrivalIso: string | null): FlightStatusResult {
  const digits = flightNumber.replace(/\D/g, "");
  const seed = [...flightNumber].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const scheduled = scheduledArrivalIso ?? new Date(Date.now() + 3 * 3_600_000).toISOString();
  if (digits.endsWith("0") && digits.length > 0) {
    return {
      flightNumber,
      status: "cancelled",
      scheduledArrival: scheduled,
      estimatedArrival: null,
      arrivalAirport: null,
      delayMinutes: null,
      simulated: true,
    };
  }
  const delayOptions = [0, 0, 5, 25, 45, 70, -15];
  const delay = delayOptions[seed % delayOptions.length];
  const estimated = new Date(Date.parse(scheduled) + delay * 60_000).toISOString();
  const minutesToArrival = (Date.parse(estimated) - Date.now()) / 60_000;
  let status: FlightStatusResult["status"] =
    minutesToArrival <= 0 ? "landed" : minutesToArrival < 240 ? "en-route" : "scheduled";
  if (status !== "landed" && delay > FLIGHT_ADJUST_THRESHOLD_MINUTES) status = "delayed";
  return {
    flightNumber,
    status,
    scheduledArrival: scheduled,
    estimatedArrival: estimated,
    arrivalAirport: null,
    delayMinutes: delay,
    simulated: true,
  };
}

export async function getFlightStatus(
  flightNumber: string,
  scheduledArrivalIso: string | null,
): Promise<FlightStatusResult> {
  const clean = flightNumber.replace(/\s+/g, "").toUpperCase();
  if (!serverEnv.airlabsReady()) return simulateFlight(clean, scheduledArrivalIso);
  try {
    return await fetchAirLabs(clean);
  } catch (err) {
    console.error("[flights] AirLabs lookup failed", err);
    return {
      flightNumber: clean,
      status: "unknown",
      scheduledArrival: scheduledArrivalIso,
      estimatedArrival: null,
      arrivalAirport: null,
      delayMinutes: null,
      simulated: false,
    };
  }
}

/**
 * Decides whether a pickup must move. The customer books the pickup at the
 * scheduled arrival time, so the new pickup is simply the estimated arrival.
 */
export function computePickupAdjustment(
  scheduledPickupIso: string,
  flight: FlightStatusResult,
): { shouldUpdate: boolean; adjustedPickupAt: string | null; flightStatus: string } {
  if (flight.status === "cancelled") {
    return { shouldUpdate: true, adjustedPickupAt: null, flightStatus: "cancelled" };
  }
  if (!flight.estimatedArrival) {
    return { shouldUpdate: false, adjustedPickupAt: null, flightStatus: flight.status };
  }
  const diffMinutes = (Date.parse(flight.estimatedArrival) - Date.parse(scheduledPickupIso)) / 60_000;
  if (Math.abs(diffMinutes) > FLIGHT_ADJUST_THRESHOLD_MINUTES) {
    const status = flight.status === "landed" ? "landed" : diffMinutes > 0 ? "delayed" : "early";
    return { shouldUpdate: true, adjustedPickupAt: flight.estimatedArrival, flightStatus: status };
  }
  return { shouldUpdate: false, adjustedPickupAt: null, flightStatus: flight.status === "landed" ? "landed" : "on_time" };
}
