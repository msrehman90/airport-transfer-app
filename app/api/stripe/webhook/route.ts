import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { jsonError } from "@/lib/server/http";
import { markBookingPaid } from "@/lib/server/payments";
import { getBookingByPaymentIntent, getBookingByRef, updateBooking } from "@/lib/server/repo";
import { getStripe } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook — Stripe events.
 * payment_intent.succeeded → payment_status = 'paid', status = 'confirmed', confirmation email.
 * charge.refunded → payment_status = 'refunded'.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return jsonError("Stripe webhook is not configured.", 501);
  if (!serverEnv.supabaseReady()) return NextResponse.json({ received: true, skipped: "no database" });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonError("Missing signature", 400);

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe:webhook] signature verification failed", err);
    return jsonError("Invalid signature", 400);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const ref = intent.metadata?.booking_ref;
        const booking = (await getBookingByPaymentIntent(intent.id)) ?? (ref ? await getBookingByRef(ref) : null);
        if (booking) await markBookingPaid(booking, intent.amount_received / 100, intent.id);
        else console.warn("[stripe:webhook] no booking for payment intent", intent.id);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intentId) {
          const booking = await getBookingByPaymentIntent(intentId);
          if (booking && booking.paymentStatus !== "refunded") {
            await updateBooking(booking.id, {
              paymentStatus: "refunded",
              refundAmount: charge.amount_refunded / 100,
            });
          }
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe:webhook] handler error", err);
    return jsonError("Webhook handler failed", 500);
  }
}
