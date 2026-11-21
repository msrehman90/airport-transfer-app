"use client";

import { publicEnv } from "../env";
import { evaluateCancellation, type CancellationDecision } from "../policy";
import type { Booking, BookingStatus, BookingView, Driver, FlatRate, FleetVehicle, FlightStatusResult, QuoteResult, VehicleClass } from "../types";
import { contactMatches, type BookingInput, type TripInput } from "../validation";
import {
  demoAddDriver,
  demoCatalog,
  demoFindByRef,
  demoFlatRateOverrides,
  demoInsertBooking,
  demoListBookings,
  demoSetFlatRate,
  demoUpdateBooking,
  loadDemoDB,
} from "./demo-store";

/** True when bookings are stored in Supabase; false = LocalStorage Demo Mode. */
export const LIVE_DATA = publicEnv.supabaseEnabled;

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Network error — check your connection and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; fieldErrors?: Record<string, string> };
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.fieldErrors ?? {});
  return data;
}

/* --------------------------------- Catalog --------------------------------- */

export interface Catalog {
  vehicleClasses: VehicleClass[];
  flatRates: FlatRate[];
}

export async function fetchCatalog(): Promise<Catalog> {
  if (!LIVE_DATA) return demoCatalog();
  return request<Catalog>("/api/catalog");
}

/* ---------------------------------- Quotes --------------------------------- */

export async function fetchQuote(trip: TripInput): Promise<QuoteResult> {
  const data = await request<{ quote: QuoteResult }>("/api/quote", {
    method: "POST",
    body: JSON.stringify({ trip, demoFlatRateOverrides: LIVE_DATA ? null : demoFlatRateOverrides() }),
  });
  return data.quote;
}

/* --------------------------------- Bookings -------------------------------- */

export async function createBooking(input: BookingInput): Promise<{ booking: Booking; quote: QuoteResult; emailed: boolean }> {
  const data = await request<{ booking: Booking; quote: QuoteResult; emailed?: boolean; demo: boolean }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ booking: input, demoFlatRateOverrides: LIVE_DATA ? null : demoFlatRateOverrides() }),
  });
  if (data.demo) demoInsertBooking(data.booking);
  return { booking: data.booking, quote: data.quote, emailed: Boolean(data.emailed) };
}

export interface PaymentStart {
  demo: boolean;
  amount: number;
  clientSecret?: string;
  paymentIntentId?: string;
}

export async function startPayment(bookingRef: string, input: BookingInput): Promise<PaymentStart> {
  const data = await request<{ demo?: boolean; amount: number; clientSecret?: string; paymentIntentId?: string }>(
    "/api/stripe/payment-intent",
    { method: "POST", body: JSON.stringify({ bookingRef, booking: LIVE_DATA ? undefined : input }) },
  );
  return { demo: Boolean(data.demo), amount: data.amount, clientSecret: data.clientSecret, paymentIntentId: data.paymentIntentId };
}

export async function confirmPayment(bookingRef: string, paymentIntentId: string | null): Promise<boolean> {
  const data = await request<{ paid: boolean; amountPaid?: number | null }>("/api/stripe/confirm", {
    method: "POST",
    body: JSON.stringify({ bookingRef, paymentIntentId }),
  });
  if (data.paid && !LIVE_DATA) {
    const local = demoFindByRef(bookingRef);
    if (local && local.paymentStatus !== "paid") {
      demoUpdateBooking(local.id, {
        paymentStatus: "paid",
        status: "confirmed",
        isQuote: false,
        finalFare: data.amountPaid ?? local.estimatedFare,
        stripePaymentIntentId: paymentIntentId,
      });
    }
  }
  return data.paid;
}

export interface LookupResult {
  booking: BookingView;
  cancellation: CancellationDecision;
}

export async function lookupBooking(bookingRef: string, contact: string): Promise<LookupResult> {
  if (!LIVE_DATA) {
    const booking = demoFindByRef(bookingRef);
    if (!booking || !contactMatches(contact, booking.customerEmail, booking.customerPhone)) {
      throw new ApiError("We couldn't find a booking with that reference and contact detail.", 404);
    }
    return { booking, cancellation: evaluateCancellation(booking) };
  }
  return request<LookupResult>("/api/bookings/lookup", {
    method: "POST",
    body: JSON.stringify({ bookingRef, contact }),
  });
}

export async function cancelBooking(bookingRef: string, contact: string): Promise<{ refundAmount: number; message: string }> {
  if (!LIVE_DATA) {
    const booking = demoFindByRef(bookingRef);
    if (!booking || !contactMatches(contact, booking.customerEmail, booking.customerPhone)) {
      throw new ApiError("Booking not found.", 404);
    }
    const decision = evaluateCancellation(booking);
    if (!decision.allowed) throw new ApiError(decision.reason, 409);
    const refundAmount = decision.refundable ? decision.refundAmount : 0;
    demoUpdateBooking(booking.id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      refundAmount,
      paymentStatus: refundAmount > 0 ? "refunded" : booking.paymentStatus,
    });
    return { refundAmount, message: decision.reason };
  }
  return request<{ refundAmount: number; message: string }>(`/api/bookings/${encodeURIComponent(bookingRef)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ contact }),
  });
}

export async function fetchFlightStatus(
  flight: string,
  scheduled: string | null,
): Promise<{ flight: FlightStatusResult; adjustment: { shouldUpdate: boolean; adjustedPickupAt: string | null; flightStatus: string } | null }> {
  const params = new URLSearchParams({ flight });
  if (scheduled) params.set("scheduled", scheduled);
  return request(`/api/flights?${params.toString()}`);
}

/** Demo Mode: apply a flight check to the local booking (the cron does this in live mode). */
export function applyDemoFlightUpdate(bookingId: string, flightStatus: string, adjustedPickupAt: string | null) {
  if (LIVE_DATA) return;
  demoUpdateBooking(bookingId, { flightStatus, ...(adjustedPickupAt ? { adjustedPickupAt } : {}) });
}

/* ----------------------------------- Auth ---------------------------------- */

export interface SessionInfo {
  role: "admin" | "driver";
  driverId: string | null;
}

export async function getSession(): Promise<SessionInfo | null> {
  const data = await request<{ session: SessionInfo | null }>("/api/auth");
  return data.session;
}

export async function login(
  role: "admin" | "driver",
  passcode: string,
  driverId?: string,
): Promise<{ session?: SessionInfo; needsDriver?: boolean; drivers?: { id: string; fullName: string }[] | null }> {
  return request("/api/auth", { method: "POST", body: JSON.stringify({ role, passcode, driverId }) });
}

export async function logout(): Promise<void> {
  await request("/api/auth", { method: "DELETE" });
}

/* ---------------------------------- Admin ---------------------------------- */

export interface AdminData {
  bookings: BookingView[];
  drivers: Driver[];
  vehicles: FleetVehicle[];
  vehicleClasses: VehicleClass[];
  flatRates: FlatRate[];
}

export async function fetchAdminData(): Promise<AdminData> {
  if (!LIVE_DATA) {
    const db = loadDemoDB();
    const catalog = demoCatalog();
    return { bookings: demoListBookings(), drivers: db.drivers, vehicles: db.vehicles, ...catalog };
  }
  return request<AdminData>("/api/admin/data");
}

export interface AdminBookingPatch {
  status?: BookingStatus;
  driverId?: string | null;
  vehicleId?: string | null;
  finalFare?: number | null;
  notes?: string | null;
}

export async function adminUpdateBooking(id: string, patch: AdminBookingPatch): Promise<BookingView> {
  if (!LIVE_DATA) {
    const db = loadDemoDB();
    const existing = db.bookings.find((b) => b.id === id);
    if (!existing) throw new ApiError("Booking not found.", 404);
    if (existing.paymentStatus === "paid" && patch.finalFare != null && patch.finalFare !== existing.finalFare) {
      throw new ApiError("This booking is already paid; refund or charge the difference in Stripe.", 409);
    }
    const next: Partial<Booking> = { ...patch };
    if (patch.driverId && !patch.status && (existing.status === "confirmed" || existing.status === "pending")) {
      next.status = "assigned";
    }
    const updated = demoUpdateBooking(id, next);
    if (!updated) throw new ApiError("Booking not found.", 404);
    return updated;
  }
  const data = await request<{ booking: BookingView }>(`/api/admin/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.booking;
}

export async function adminAddDriver(input: { fullName: string; phone: string; email: string; licenseNumber: string }): Promise<Driver> {
  if (!LIVE_DATA) {
    return demoAddDriver({
      fullName: input.fullName,
      phone: input.phone,
      email: input.email || null,
      licenseNumber: input.licenseNumber || null,
    });
  }
  const data = await request<{ driver: Driver }>("/api/admin/drivers", { method: "POST", body: JSON.stringify(input) });
  return data.driver;
}

export async function adminSaveFlatRate(rate: {
  airportCode: string;
  cityZone: string;
  vehicleClassId: string;
  vehicleSlug: string;
  oneWayFare: number;
}): Promise<void> {
  if (!LIVE_DATA) {
    demoSetFlatRate(`${rate.airportCode}|${rate.cityZone}|${rate.vehicleSlug}`, rate.oneWayFare);
    return;
  }
  await request("/api/admin/flat-rates", {
    method: "PUT",
    body: JSON.stringify({
      airportCode: rate.airportCode,
      cityZone: rate.cityZone,
      vehicleClassId: rate.vehicleClassId,
      oneWayFare: rate.oneWayFare,
    }),
  });
}

/* ---------------------------------- Driver --------------------------------- */

export async function fetchDriverRides(driverId: string): Promise<{ driver: Driver; rides: BookingView[] }> {
  if (!LIVE_DATA) {
    const db = loadDemoDB();
    const driver = db.drivers.find((d) => d.id === driverId);
    if (!driver) throw new ApiError("Driver not found.", 404);
    const rides = demoListBookings().filter((b) => b.driverId === driverId && b.status !== "cancelled");
    return { driver, rides };
  }
  return request("/api/driver/rides");
}

export async function driverUpdateRide(ride: BookingView, status: BookingStatus): Promise<BookingView> {
  if (!LIVE_DATA) {
    const updated = demoUpdateBooking(ride.id, { status });
    if (!updated) throw new ApiError("Ride not found.", 404);
    return updated;
  }
  const data = await request<{ ride: BookingView }>(`/api/driver/rides/${ride.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return data.ride;
}

export function demoDrivers(): Driver[] {
  return loadDemoDB().drivers;
}
