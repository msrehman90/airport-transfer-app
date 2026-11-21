import { DEFAULT_FLAT_RATES, VEHICLE_CLASSES, type AirportCode, type VehicleSlug } from "./config";
import type { Booking, BookingView, Driver, FlatRate, FleetVehicle, VehicleClass } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export function demoVehicleClassId(slug: string): string {
  return `vc-${slug}`;
}

/** Vehicle classes built from lib/config.ts (Demo Mode). */
export function seedVehicleClasses(): VehicleClass[] {
  return VEHICLE_CLASSES.map((v) => ({
    id: demoVehicleClassId(v.slug),
    slug: v.slug,
    name: v.name,
    description: v.description,
    exampleModels: v.exampleModels,
    maxPassengers: v.maxPassengers,
    maxLuggage: v.maxLuggage,
    hourlyRate: v.hourlyRate,
    minHours: v.minHours,
    baseFare: v.baseFare,
    perMileRate: v.perMileRate,
  }));
}

/** Flat rates built from lib/config.ts (Demo Mode). */
export function seedFlatRates(): FlatRate[] {
  return DEFAULT_FLAT_RATES.map((r) => ({
    id: `fr-${r.airportCode}-${r.cityZone}-${r.vehicleSlug}`,
    airportCode: r.airportCode,
    cityZone: r.cityZone,
    vehicleClassId: demoVehicleClassId(r.vehicleSlug),
    vehicleSlug: r.vehicleSlug,
    oneWayFare: r.oneWayFare,
  }));
}

export function rowToVehicleClass(r: Row): VehicleClass {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? "",
    exampleModels: r.example_models ?? "",
    maxPassengers: num(r.max_passengers),
    maxLuggage: num(r.max_luggage),
    hourlyRate: num(r.hourly_rate),
    minHours: num(r.min_hours),
    baseFare: num(r.base_fare),
    perMileRate: num(r.per_mile_rate),
  };
}

export function rowToFlatRate(r: Row): FlatRate {
  return {
    id: r.id,
    airportCode: r.airport_code as AirportCode,
    cityZone: r.city_zone,
    vehicleClassId: r.vehicle_class_id,
    vehicleSlug: (r.vehicle_classes?.slug ?? "sedan") as VehicleSlug,
    oneWayFare: num(r.one_way_fare),
  };
}

export function rowToDriver(r: Row): Driver {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email ?? null,
    licenseNumber: r.license_number ?? null,
    status: r.status ?? "available",
  };
}

export function rowToVehicle(r: Row): FleetVehicle {
  return {
    id: r.id,
    vehicleClassId: r.vehicle_class_id,
    vehicleSlug: (r.vehicle_classes?.slug ?? "sedan") as VehicleSlug,
    makeModel: r.make_model,
    plateNumber: r.plate_number,
    year: num(r.year),
    driverId: r.driver_id ?? null,
    status: r.status ?? "active",
  };
}

export function rowToBooking(r: Row): Booking {
  return {
    id: r.id,
    bookingRef: r.booking_ref,
    serviceType: r.service_type,
    tripType: r.trip_type,
    vehicleClassId: r.vehicle_class_id,
    vehicleSlug: (r.vehicle_classes?.slug ?? "sedan") as VehicleSlug,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    pickupAddress: r.pickup_address,
    dropoffAddress: r.dropoff_address ?? null,
    airportCode: r.airport_code ?? null,
    cityZone: r.city_zone ?? null,
    hoursBooked: numOrNull(r.hours_booked),
    passengers: num(r.passengers),
    luggage: num(r.luggage),
    scheduledPickupAt: r.scheduled_pickup_at,
    adjustedPickupAt: r.adjusted_pickup_at ?? null,
    flightNumber: r.flight_number ?? null,
    flightStatus: r.flight_status ?? null,
    returnPickupAt: r.return_pickup_at ?? null,
    returnFlightNumber: r.return_flight_number ?? null,
    meetAndGreet: Boolean(r.meet_and_greet),
    childSeats: num(r.child_seats),
    notes: r.notes ?? null,
    estimatedFare: num(r.estimated_fare),
    finalFare: numOrNull(r.final_fare),
    distanceMiles: numOrNull(r.distance_miles),
    pricingMethod: r.pricing_method ?? null,
    isQuote: Boolean(r.is_quote),
    stripePaymentIntentId: r.stripe_payment_intent_id ?? null,
    paymentStatus: r.payment_status ?? "unpaid",
    status: r.status ?? "pending",
    driverId: r.driver_id ?? null,
    vehicleId: r.vehicle_id ?? null,
    refundAmount: numOrNull(r.refund_amount),
    cancelledAt: r.cancelled_at ?? null,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

export function rowToBookingView(r: Row): BookingView {
  const b = rowToBooking(r);
  return {
    ...b,
    driver: r.drivers ? { id: r.drivers.id, fullName: r.drivers.full_name, phone: r.drivers.phone } : null,
    vehicle: r.vehicles
      ? { id: r.vehicles.id, makeModel: r.vehicles.make_model, plateNumber: r.vehicles.plate_number }
      : null,
  };
}

/** Booking (app model) → database row for insert. */
export function bookingToRow(b: Booking): Row {
  return {
    booking_ref: b.bookingRef,
    service_type: b.serviceType,
    trip_type: b.tripType,
    vehicle_class_id: b.vehicleClassId,
    customer_name: b.customerName,
    customer_email: b.customerEmail,
    customer_phone: b.customerPhone,
    pickup_address: b.pickupAddress,
    dropoff_address: b.dropoffAddress,
    airport_code: b.airportCode,
    city_zone: b.cityZone,
    hours_booked: b.hoursBooked,
    passengers: b.passengers,
    luggage: b.luggage,
    scheduled_pickup_at: b.scheduledPickupAt,
    adjusted_pickup_at: b.adjustedPickupAt,
    flight_number: b.flightNumber,
    flight_status: b.flightStatus,
    return_pickup_at: b.returnPickupAt,
    return_flight_number: b.returnFlightNumber,
    meet_and_greet: b.meetAndGreet,
    child_seats: b.childSeats,
    notes: b.notes,
    estimated_fare: b.estimatedFare,
    final_fare: b.finalFare,
    distance_miles: b.distanceMiles,
    pricing_method: b.pricingMethod,
    is_quote: b.isQuote,
    payment_status: b.paymentStatus,
    status: b.status,
  };
}

/** Partial camelCase booking patch → snake_case update. */
export function bookingPatchToRow(patch: Partial<Booking>): Row {
  const map: Record<string, string> = {
    status: "status",
    paymentStatus: "payment_status",
    driverId: "driver_id",
    vehicleId: "vehicle_id",
    finalFare: "final_fare",
    estimatedFare: "estimated_fare",
    adjustedPickupAt: "adjusted_pickup_at",
    flightStatus: "flight_status",
    stripePaymentIntentId: "stripe_payment_intent_id",
    refundAmount: "refund_amount",
    cancelledAt: "cancelled_at",
    notes: "notes",
    isQuote: "is_quote",
  };
  const row: Row = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = map[k];
    if (col && v !== undefined) row[col] = v;
  }
  return row;
}

export const BOOKING_VIEW_SELECT =
  "*, vehicle_classes(slug), drivers(id, full_name, phone), vehicles(id, make_model, plate_number)";
