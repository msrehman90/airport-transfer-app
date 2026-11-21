import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { evaluateCancellation } from "@/lib/policy";
import { toCents } from "@/lib/pricing";
import { publicBooking } from "@/lib/server/bookings";
import { sendCancellationEmail } from "@/lib/server/email";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { getBookingByRef, updateBooking } from "@/lib/server/repo";
import { getStripe } from "@/lib/server/stripe";
import { cancelSchema, contactMatches } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/[ref]/cancel — customer cancellation.
 * Enforces the 24-hour policy (or airline-cancellation override) and refunds via Stripe.
 */
export async function POST(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  if (!serverEnv.supabaseReady()) {
    return jsonError("Cancellations are handled in the browser in Demo Mode.", 409, { demo: true });
  }
  const { ref } = await params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { contact } = cancelSchema.parse(body);
    const booking = await getBookingByRef(ref);
    if (!booking || !contactMatches(contact, booking.customerEmail, booking.customerPhone)) {
      return jsonError("Booking not found.", 404);
    }

    const decision = evaluateCancellation(booking);
    if (!decision.allowed) return jsonError(decision.reason, 409);

    let refundAmount = 0;
    let paymentStatus = booking.paymentStatus;
    if (decision.refundable && decision.refundAmount > 0 && booking.stripePaymentIntentId) {
      const stripe = getStripe();
      if (!stripe) return jsonError("Refunds are unavailable right now. Please call dispatch.", 503);
      await stripe.refunds.create(
        { payment_intent: booking.stripePaymentIntentId, amount: toCents(decision.refundAmount) },
        { idempotencyKey: `refund-${booking.id}` },
      );
      refundAmount = decision.refundAmount;
      paymentStatus = "refunded";
    }

    const updated = await updateBooking(booking.id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      refundAmount,
      paymentStatus,
    });
    await sendCancellationEmail(updated, refundAmount, decision.reason);

    return NextResponse.json({ booking: publicBooking(updated), refundAmount, message: decision.reason });
  } catch (err) {
    return handleRouteError(err);
  }
}
