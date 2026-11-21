import { NextResponse } from "next/server";
import { FLIGHT_ADJUST_THRESHOLD_MINUTES, FLIGHT_LOOKAHEAD_HOURS } from "@/lib/config";
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/server/auth";
import { sendFlightAlertEmail } from "@/lib/server/email";
import { computePickupAdjustment, getFlightStatus } from "@/lib/server/flights";
import { jsonError } from "@/lib/server/http";
import { getDriver, listUpcomingFlightPickups, markFlightChecked } from "@/lib/server/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  const query = new URL(request.url).searchParams.get("secret") ?? "";
  return safeEqual(header, `Bearer ${secret}`) || safeEqual(query, secret);
}

/**
 * GET /api/cron/flight-status — run every 15 minutes by Vercel Cron.
 * Checks inbound flights for pickups in the next 6 hours and moves the pickup
 * time when the arrival estimate shifts by more than 10 minutes.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) {
    return NextResponse.json({ skipped: true, reason: "Supabase is not configured (Demo Mode)." });
  }

  const bookings = await listUpcomingFlightPickups(FLIGHT_LOOKAHEAD_HOURS);
  const results: { ref: string; flight: string; status: string; adjustedPickupAt: string | null; alerted: boolean }[] = [];

  for (const booking of bookings) {
    if (!booking.flightNumber) continue;
    try {
      const flight = await getFlightStatus(booking.flightNumber, booking.scheduledPickupAt);
      const decision = computePickupAdjustment(booking.scheduledPickupAt, flight);

      const previousAdjusted = booking.adjustedPickupAt ? Date.parse(booking.adjustedPickupAt) : null;
      const nextAdjusted = decision.adjustedPickupAt ? Date.parse(decision.adjustedPickupAt) : null;
      const movedAgain =
        nextAdjusted != null &&
        (previousAdjusted == null ||
          Math.abs(nextAdjusted - previousAdjusted) / 60_000 > FLIGHT_ADJUST_THRESHOLD_MINUTES);
      const statusChanged = decision.flightStatus !== booking.flightStatus;

      let alerted = false;
      if (decision.shouldUpdate && (movedAgain || statusChanged)) {
        await markFlightChecked(booking.id, {
          flightStatus: decision.flightStatus,
          ...(decision.adjustedPickupAt ? { adjustedPickupAt: decision.adjustedPickupAt } : {}),
        });
        const driver = booking.driverId ? await getDriver(booking.driverId) : null;
        await sendFlightAlertEmail(
          booking,
          driver?.email ?? null,
          decision.flightStatus,
          decision.adjustedPickupAt ?? booking.scheduledPickupAt,
        );
        alerted = true;
      } else {
        await markFlightChecked(booking.id, statusChanged ? { flightStatus: decision.flightStatus } : {});
      }

      results.push({
        ref: booking.bookingRef,
        flight: booking.flightNumber,
        status: decision.flightStatus,
        adjustedPickupAt: decision.adjustedPickupAt,
        alerted,
      });
    } catch (err) {
      console.error(`[cron:flight-status] ${booking.bookingRef} failed`, err);
      results.push({ ref: booking.bookingRef, flight: booking.flightNumber, status: "error", adjustedPickupAt: null, alerted: false });
    }
  }

  return NextResponse.json({ checked: results.length, results, simulated: !serverEnv.airlabsReady() });
}
