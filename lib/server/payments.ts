import "server-only";
import { CHILD_SEAT_FEE, MEET_AND_GREET_FEE, SERVICE_TYPE_LABELS } from "../config";
import type { Booking, BookingView, QuoteLineItem } from "../types";
import { sendConfirmationEmail } from "./email";
import { updateBooking } from "./repo";

/** Rebuilds an itemised receipt from a stored booking. */
export function receiptLineItems(b: Booking, total: number): QuoteLineItem[] {
  const extras: QuoteLineItem[] = [];
  if (b.meetAndGreet) extras.push({ label: "Meet & Greet inside terminal", amount: MEET_AND_GREET_FEE });
  if (b.childSeats > 0) extras.push({ label: `Child safety seat × ${b.childSeats}`, amount: b.childSeats * CHILD_SEAT_FEE });
  const extrasTotal = extras.reduce((s, li) => s + li.amount, 0);
  const tripLabel = `${SERVICE_TYPE_LABELS[b.serviceType]}${b.tripType === "round_trip" ? " (round trip)" : ""}`;
  return [{ label: tripLabel, amount: Number((total - extrasTotal).toFixed(2)) }, ...extras];
}

/**
 * Idempotently marks a booking paid + confirmed and sends the confirmation email.
 * Called from both the Stripe webhook and the client-side confirm endpoint, so
 * whichever arrives first wins and the other is a no-op.
 */
export async function markBookingPaid(
  booking: BookingView,
  amountPaid: number,
  paymentIntentId: string | null,
): Promise<BookingView> {
  if (booking.paymentStatus === "paid") return booking;
  const updated = await updateBooking(booking.id, {
    paymentStatus: "paid",
    status: booking.status === "pending" ? "confirmed" : booking.status,
    finalFare: amountPaid,
    isQuote: false,
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
  });
  await sendConfirmationEmail(updated, receiptLineItems(updated, amountPaid));
  return updated;
}
