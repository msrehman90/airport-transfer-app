import type { Booking } from "../types";
import { OTHER_ZONE, type BookingInput } from "../validation";

/**
 * Rebuilds the original booking request from a stored booking. Used when a
 * saved quote is paid later and the booking lives in LocalStorage, so the
 * server can re-price it from scratch before creating the PaymentIntent.
 */
export function bookingToInput(b: Booking): BookingInput {
  const toAirport = b.serviceType === "to_airport";
  const fromAirport = b.serviceType === "from_airport";
  return {
    trip: {
      serviceType: b.serviceType,
      tripType: b.tripType,
      vehicleSlug: b.vehicleSlug,
      airportCode: b.airportCode,
      cityZone: b.cityZone ?? (toAirport || fromAirport ? OTHER_ZONE : null),
      pickupAddress: fromAirport ? "" : b.pickupAddress,
      dropoffAddress: toAirport ? "" : b.dropoffAddress ?? "",
      hours: b.hoursBooked,
      passengers: b.passengers,
      luggage: b.luggage,
      meetAndGreet: b.meetAndGreet,
      childSeats: b.childSeats,
      scheduledPickupAt: b.scheduledPickupAt,
      returnPickupAt: b.returnPickupAt,
      flightNumber: b.flightNumber,
      returnFlightNumber: b.returnFlightNumber,
    },
    customer: { name: b.customerName, email: b.customerEmail, phone: b.customerPhone },
    notes: b.notes ?? "",
    mode: "book",
  };
}
