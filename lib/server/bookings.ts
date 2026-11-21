import "server-only";
import { generateBookingRef, generateId } from "../booking-ref";
import type { Booking, QuoteResult } from "../types";
import { OTHER_ZONE, type BookingInput } from "../validation";

/** Builds a new Booking record from validated input and a server-computed quote. */
export function buildBooking(input: BookingInput, quote: QuoteResult): Booking {
  const t = input.trip;
  const isAirport = t.serviceType === "to_airport" || t.serviceType === "from_airport";
  return {
    id: generateId(),
    bookingRef: generateBookingRef(),
    serviceType: t.serviceType,
    tripType: t.serviceType === "hourly" ? "one_way" : t.tripType,
    vehicleClassId: quote.vehicle.id,
    vehicleSlug: quote.vehicle.slug,
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    customerPhone: input.customer.phone,
    pickupAddress: quote.pickupAddress,
    dropoffAddress: quote.dropoffAddress,
    airportCode: isAirport ? (t.airportCode as Booking["airportCode"]) : null,
    cityZone: isAirport ? (t.cityZone ?? OTHER_ZONE) : null,
    hoursBooked: t.serviceType === "hourly" ? quote.billableHours : null,
    passengers: t.passengers,
    luggage: t.luggage,
    scheduledPickupAt: new Date(t.scheduledPickupAt!).toISOString(),
    adjustedPickupAt: null,
    flightNumber: t.flightNumber || null,
    flightStatus: null,
    returnPickupAt: t.tripType === "round_trip" && t.returnPickupAt ? new Date(t.returnPickupAt).toISOString() : null,
    returnFlightNumber: t.tripType === "round_trip" ? t.returnFlightNumber || null : null,
    meetAndGreet: t.meetAndGreet,
    childSeats: t.childSeats,
    notes: input.notes || null,
    estimatedFare: quote.breakdown.totalFare,
    finalFare: null,
    distanceMiles: quote.distanceMiles,
    pricingMethod: quote.breakdown.pricingMethod,
    isQuote: input.mode === "quote",
    stripePaymentIntentId: null,
    paymentStatus: "unpaid",
    status: "pending",
    driverId: null,
    vehicleId: null,
    refundAmount: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
  };
}

/** Customer-safe projection of a booking (no internal payment ids). */
export function publicBooking<T extends Booking>(b: T): Omit<T, "stripePaymentIntentId"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stripePaymentIntentId, ...rest } = b;
  return rest;
}
