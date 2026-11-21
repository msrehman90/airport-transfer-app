import "server-only";
import {
  BOOKING_VIEW_SELECT,
  bookingPatchToRow,
  bookingToRow,
  rowToBooking,
  rowToBookingView,
  rowToDriver,
  rowToFlatRate,
  rowToVehicle,
  rowToVehicleClass,
  seedFlatRates,
  seedVehicleClasses,
} from "../mappers";
import type { Booking, BookingView, Driver, FlatRate, FleetVehicle, VehicleClass } from "../types";
import { getSupabaseAdmin, requireSupabase } from "./supabase";

/* ---------------------------- Catalog (both modes) ---------------------------- */

export async function getVehicleClasses(): Promise<VehicleClass[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return seedVehicleClasses();
  const { data, error } = await sb.from("vehicle_classes").select("*").order("sort_order").order("hourly_rate");
  if (error) throw new Error(`Failed to load vehicle classes: ${error.message}`);
  return (data ?? []).map(rowToVehicleClass);
}

export async function getFlatRates(): Promise<FlatRate[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return seedFlatRates();
  const { data, error } = await sb.from("flat_rates").select("*, vehicle_classes(slug)");
  if (error) throw new Error(`Failed to load flat rates: ${error.message}`);
  return (data ?? []).map(rowToFlatRate);
}

export async function findFlatRate(
  airportCode: string,
  cityZone: string,
  vehicleClassId: string,
): Promise<number | null> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const row = seedFlatRates().find(
      (r) => r.airportCode === airportCode && r.cityZone === cityZone && r.vehicleClassId === vehicleClassId,
    );
    return row ? row.oneWayFare : null;
  }
  const { data, error } = await sb
    .from("flat_rates")
    .select("one_way_fare")
    .eq("airport_code", airportCode)
    .eq("city_zone", cityZone)
    .eq("vehicle_class_id", vehicleClassId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load flat rate: ${error.message}`);
  return data ? Number(data.one_way_fare) : null;
}

export async function upsertFlatRate(input: {
  airportCode: string;
  cityZone: string;
  vehicleClassId: string;
  oneWayFare: number;
}): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("flat_rates").upsert(
    {
      airport_code: input.airportCode,
      city_zone: input.cityZone,
      vehicle_class_id: input.vehicleClassId,
      one_way_fare: input.oneWayFare,
    },
    { onConflict: "airport_code,city_zone,vehicle_class_id" },
  );
  if (error) throw new Error(`Failed to save flat rate: ${error.message}`);
}

/* --------------------------------- Bookings --------------------------------- */

export async function insertBooking(booking: Booking): Promise<Booking> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .insert(bookingToRow(booking))
    .select("*, vehicle_classes(slug)")
    .single();
  if (error) throw new Error(`Failed to save booking: ${error.message}`);
  return rowToBooking(data);
}

export async function getBookingByRef(ref: string): Promise<BookingView | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .select(BOOKING_VIEW_SELECT)
    .eq("booking_ref", ref.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  return data ? rowToBookingView(data) : null;
}

export async function getBookingById(id: string): Promise<BookingView | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("bookings").select(BOOKING_VIEW_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  return data ? rowToBookingView(data) : null;
}

export async function getBookingByPaymentIntent(paymentIntentId: string): Promise<BookingView | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .select(BOOKING_VIEW_SELECT)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  return data ? rowToBookingView(data) : null;
}

export async function updateBooking(id: string, patch: Partial<Booking>): Promise<BookingView> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .update(bookingPatchToRow(patch))
    .eq("id", id)
    .select(BOOKING_VIEW_SELECT)
    .single();
  if (error) throw new Error(`Failed to update booking: ${error.message}`);
  return rowToBookingView(data);
}

export async function listBookings(): Promise<BookingView[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .select(BOOKING_VIEW_SELECT)
    .order("scheduled_pickup_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  return (data ?? []).map(rowToBookingView);
}

export async function listDriverRides(driverId: string): Promise<BookingView[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("bookings")
    .select(BOOKING_VIEW_SELECT)
    .eq("driver_id", driverId)
    .neq("status", "cancelled")
    .order("scheduled_pickup_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`Failed to load rides: ${error.message}`);
  return (data ?? []).map(rowToBookingView);
}

/** Inbound airport pickups in the next few hours whose flights should be checked. */
export async function listUpcomingFlightPickups(lookaheadHours: number): Promise<BookingView[]> {
  const sb = requireSupabase();
  const now = new Date();
  const until = new Date(now.getTime() + lookaheadHours * 3_600_000);
  const { data, error } = await sb
    .from("bookings")
    .select(BOOKING_VIEW_SELECT)
    .eq("service_type", "from_airport")
    .not("flight_number", "is", null)
    .in("status", ["confirmed", "pending", "assigned"])
    .gte("scheduled_pickup_at", now.toISOString())
    .lte("scheduled_pickup_at", until.toISOString());
  if (error) throw new Error(`Failed to load flight pickups: ${error.message}`);
  return (data ?? []).map(rowToBookingView);
}

export async function markFlightChecked(id: string, patch: Partial<Booking>): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("bookings")
    .update({ ...bookingPatchToRow(patch), flight_checked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to update flight status: ${error.message}`);
}

/* ------------------------------ Drivers & fleet ------------------------------ */

export async function listDrivers(): Promise<Driver[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("drivers").select("*").order("full_name");
  if (error) throw new Error(`Failed to load drivers: ${error.message}`);
  return (data ?? []).map(rowToDriver);
}

export async function getDriver(id: string): Promise<Driver | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("drivers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load driver: ${error.message}`);
  return data ? rowToDriver(data) : null;
}

export async function createDriver(input: {
  fullName: string;
  phone: string;
  email?: string | null;
  licenseNumber?: string | null;
}): Promise<Driver> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("drivers")
    .insert({
      full_name: input.fullName,
      phone: input.phone,
      email: input.email || null,
      license_number: input.licenseNumber || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create driver: ${error.message}`);
  return rowToDriver(data);
}

export async function listFleetVehicles(): Promise<FleetVehicle[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("vehicles").select("*, vehicle_classes(slug)").order("plate_number");
  if (error) throw new Error(`Failed to load vehicles: ${error.message}`);
  return (data ?? []).map(rowToVehicle);
}
