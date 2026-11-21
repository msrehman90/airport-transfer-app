import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { toCents } from "@/lib/pricing";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { repriceStoredBooking, resolveQuote } from "@/lib/server/quote";
import { getBookingByRef, updateBooking } from "@/lib/server/repo";
import { getStripe } from "@/lib/server/stripe";
import { bookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bookingRef: z.string().trim().toUpperCase().min(4).max(20),
  /** Only used when Stripe is configured but Supabase is not (bookings live in LocalStorage). */
  booking: bookingSchema.optional(),
});

/**
 * POST /api/stripe/payment-intent — recomputes the fare on the server and returns
 * a Stripe clientSecret. The client never supplies the amount.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { bookingRef, booking: localInput } = bodySchema.parse(body);
    const stripe = getStripe();

    let amount: number;
    let customerEmail: string;
    let bookingId: string | null = null;
    let existingIntentId: string | null = null;

    if (serverEnv.supabaseReady()) {
      const booking = await getBookingByRef(bookingRef);
      if (!booking) return jsonError("Booking not found.", 404);
      if (booking.paymentStatus === "paid") return jsonError("This booking is already paid.", 409);
      if (booking.status === "cancelled") return jsonError("This booking was cancelled.", 409);
      // An admin-approved final fare wins; otherwise re-price from the current rate tables.
      amount = booking.finalFare ?? (await repriceStoredBooking(booking));
      customerEmail = booking.customerEmail;
      bookingId = booking.id;
      existingIntentId = booking.stripePaymentIntentId;
      if (amount !== booking.estimatedFare && booking.finalFare == null) {
        await updateBooking(booking.id, { estimatedFare: amount });
      }
    } else {
      if (!localInput) return jsonError("Booking details are required.", 400);
      const quote = await resolveQuote(localInput.trip, { requireAddresses: true });
      amount = quote.breakdown.totalFare;
      customerEmail = localInput.customer.email;
    }

    if (!stripe) {
      return NextResponse.json({ demo: true, amount });
    }

    const metadata = { booking_ref: bookingRef, ...(bookingId ? { booking_id: bookingId } : {}) };

    if (existingIntentId) {
      const existing = await stripe.paymentIntents.retrieve(existingIntentId);
      if (existing.status === "succeeded") return jsonError("This booking is already paid.", 409);
      if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(existing.status)) {
        const updated =
          existing.amount === toCents(amount)
            ? existing
            : await stripe.paymentIntents.update(existing.id, { amount: toCents(amount) });
        return NextResponse.json({ clientSecret: updated.client_secret, paymentIntentId: updated.id, amount });
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: toCents(amount),
      currency: "usd",
      receipt_email: customerEmail,
      description: `Chauffeur booking ${bookingRef}`,
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    if (bookingId) await updateBooking(bookingId, { stripePaymentIntentId: intent.id });

    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount });
  } catch (err) {
    return handleRouteError(err);
  }
}
