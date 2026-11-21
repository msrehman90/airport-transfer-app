import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { evaluateCancellation } from "@/lib/policy";
import { publicBooking } from "@/lib/server/bookings";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { getBookingByRef } from "@/lib/server/repo";
import { contactMatches, lookupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** POST /api/bookings/lookup — find a booking by reference + email or phone. */
export async function POST(request: Request) {
  if (!serverEnv.supabaseReady()) {
    return jsonError("Booking lookup runs in the browser in Demo Mode.", 409, { demo: true });
  }
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { bookingRef, contact } = lookupSchema.parse(body);
    const booking = await getBookingByRef(bookingRef);
    if (!booking || !contactMatches(contact, booking.customerEmail, booking.customerPhone)) {
      return jsonError("We couldn't find a booking with that reference and contact detail.", 404);
    }
    return NextResponse.json({
      booking: publicBooking(booking),
      cancellation: evaluateCancellation(booking),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
