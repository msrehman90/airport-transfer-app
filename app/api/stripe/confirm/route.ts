import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { publicBooking } from "@/lib/server/bookings";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { markBookingPaid } from "@/lib/server/payments";
import { getBookingByRef } from "@/lib/server/repo";
import { getStripe } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bookingRef: z.string().trim().toUpperCase().min(4).max(20),
  paymentIntentId: z.string().trim().max(100).optional().nullable(),
});

/**
 * POST /api/stripe/confirm — called by the browser after checkout.
 * With Stripe: verifies the PaymentIntent really succeeded (the webhook does the same,
 * this just makes local development work without the Stripe CLI).
 * Without Stripe: records a mock payment (Demo Mode only).
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { bookingRef, paymentIntentId } = bodySchema.parse(body);
    const stripe = getStripe();

    let amountPaid: number | null = null;
    if (stripe) {
      if (!paymentIntentId) return jsonError("Missing payment reference.", 400);
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.metadata?.booking_ref !== bookingRef) return jsonError("Payment does not match this booking.", 400);
      if (intent.status !== "succeeded") {
        return NextResponse.json({ paid: false, status: intent.status });
      }
      amountPaid = intent.amount_received / 100;
    }

    if (!serverEnv.supabaseReady()) {
      // Booking lives in LocalStorage; the browser marks it paid.
      return NextResponse.json({ paid: true, demo: !stripe, amountPaid });
    }

    const booking = await getBookingByRef(bookingRef);
    if (!booking) return jsonError("Booking not found.", 404);
    if (!stripe && booking.paymentStatus !== "paid") {
      amountPaid = booking.finalFare ?? booking.estimatedFare;
    }
    const updated = await markBookingPaid(booking, amountPaid ?? booking.finalFare ?? booking.estimatedFare, paymentIntentId ?? null);
    return NextResponse.json({ paid: true, demo: !stripe, booking: publicBooking(updated) });
  } catch (err) {
    return handleRouteError(err);
  }
}
