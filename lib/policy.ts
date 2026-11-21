import { FREE_CANCELLATION_HOURS } from "./config";
import type { Booking } from "./types";

export interface CancellationDecision {
  allowed: boolean;
  refundable: boolean;
  refundAmount: number;
  reason: string;
}

const CLOSED_STATUSES = new Set(["cancelled", "completed", "in_progress", "arrived"]);

/**
 * Cancellation policy (shared by the server and Demo Mode):
 * - Full refund if cancelled ≥ 24h before the scheduled pickup.
 * - Full refund (or free rebooking) when the airline cancelled the flight.
 * - Inside 24h the ride can still be cancelled, but the fare is non-refundable.
 */
export function evaluateCancellation(
  booking: Pick<Booking, "status" | "scheduledPickupAt" | "flightStatus" | "paymentStatus" | "estimatedFare" | "finalFare">,
  now: Date = new Date(),
): CancellationDecision {
  if (CLOSED_STATUSES.has(booking.status)) {
    return {
      allowed: false,
      refundable: false,
      refundAmount: 0,
      reason:
        booking.status === "cancelled"
          ? "This booking is already cancelled."
          : "This ride is already under way or finished and can no longer be cancelled online.",
    };
  }

  const paidAmount = booking.paymentStatus === "paid" ? booking.finalFare ?? booking.estimatedFare : 0;

  if ((booking.flightStatus ?? "").toLowerCase() === "cancelled") {
    return {
      allowed: true,
      refundable: true,
      refundAmount: paidAmount,
      reason: "Your airline cancelled the flight, so you get a 100% refund (or free rebooking).",
    };
  }

  const hoursUntilPickup = (Date.parse(booking.scheduledPickupAt) - now.getTime()) / 3_600_000;
  if (hoursUntilPickup >= FREE_CANCELLATION_HOURS) {
    return {
      allowed: true,
      refundable: true,
      refundAmount: paidAmount,
      reason: `Cancelled more than ${FREE_CANCELLATION_HOURS} hours before pickup, so you get a full refund.`,
    };
  }

  return {
    allowed: true,
    refundable: false,
    refundAmount: 0,
    reason: `Pickup is less than ${FREE_CANCELLATION_HOURS} hours away, so this cancellation is non-refundable.`,
  };
}
