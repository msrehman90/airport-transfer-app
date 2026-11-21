"use client";

import { DEMO_DRIVERS, DEMO_VEHICLES, getAirport, getVehicleSeed } from "../config";
import { demoVehicleClassId, seedFlatRates, seedVehicleClasses } from "../mappers";
import { calculateQuote } from "../pricing";
import type { Booking, BookingView, Driver, FleetVehicle } from "../types";

/**
 * LocalStorage "database" used when Supabase is not configured.
 * Fares are always computed by the server (/api/quote, /api/bookings); this store
 * only persists the results so /book, /track, /admin and /driver share state
 * inside one browser.
 */

const STORAGE_KEY = "cec_demo_db_v1";
const CHANGE_EVENT = "cec-demo-db-change";

export interface DemoDB {
  version: 1;
  bookings: Booking[];
  drivers: Driver[];
  vehicles: FleetVehicle[];
  flatRateOverrides: Record<string, number>;
}

function hoursFromNow(h: number): string {
  const d = new Date(Date.now() + h * 3_600_000);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return d.toISOString();
}

function sampleBooking(partial: Partial<Booking> & Pick<Booking, "bookingRef" | "serviceType" | "vehicleSlug">): Booking {
  const seed = getVehicleSeed(partial.vehicleSlug)!;
  const flat = seedFlatRates().find(
    (r) => r.airportCode === partial.airportCode && r.cityZone === partial.cityZone && r.vehicleSlug === partial.vehicleSlug,
  );
  const quote = calculateQuote({
    serviceType: partial.serviceType,
    tripType: partial.tripType ?? "one_way",
    hours: partial.hoursBooked ?? undefined,
    distanceMiles: partial.distanceMiles ?? undefined,
    flatRateOneWay: flat?.oneWayFare ?? null,
    vehicle: seed,
    meetAndGreet: partial.meetAndGreet ?? false,
    childSeats: partial.childSeats ?? 0,
  });
  return {
    id: `bk-${partial.bookingRef}`,
    tripType: "one_way",
    vehicleClassId: demoVehicleClassId(partial.vehicleSlug),
    customerName: "Demo Customer",
    customerEmail: "demo@example.com",
    customerPhone: "+1 (202) 555-0100",
    pickupAddress: "",
    dropoffAddress: null,
    airportCode: null,
    cityZone: null,
    hoursBooked: null,
    passengers: 2,
    luggage: 2,
    scheduledPickupAt: hoursFromNow(30),
    adjustedPickupAt: null,
    flightNumber: null,
    flightStatus: null,
    returnPickupAt: null,
    returnFlightNumber: null,
    meetAndGreet: false,
    childSeats: 0,
    notes: null,
    estimatedFare: quote.totalFare,
    finalFare: null,
    distanceMiles: null,
    pricingMethod: quote.pricingMethod,
    isQuote: false,
    stripePaymentIntentId: null,
    paymentStatus: "unpaid",
    status: "pending",
    driverId: null,
    vehicleId: null,
    refundAmount: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    ...partial,
  } as Booking;
}

function seedDB(): DemoDB {
  const dca = getAirport("DCA")!;
  const iad = getAirport("IAD")!;
  const bookings: Booking[] = [
    sampleBooking({
      bookingRef: "CE-DEMO01",
      serviceType: "from_airport",
      vehicleSlug: "sedan",
      airportCode: "DCA",
      cityZone: "dc_downtown",
      customerName: "Avery Collins",
      customerEmail: "avery@example.com",
      customerPhone: "+1 (202) 555-0110",
      pickupAddress: `${dca.name} (DCA)`,
      dropoffAddress: "1100 Pennsylvania Ave NW, Washington, DC",
      flightNumber: "AA2142",
      scheduledPickupAt: hoursFromNow(3),
      meetAndGreet: true,
      paymentStatus: "paid",
      status: "assigned",
      driverId: "drv-demo-1",
      vehicleId: "veh-demo-1",
    }),
    sampleBooking({
      bookingRef: "CE-DEMO02",
      serviceType: "to_airport",
      vehicleSlug: "suv",
      airportCode: "IAD",
      cityZone: "tysons",
      tripType: "round_trip",
      customerName: "Jordan Patel",
      customerEmail: "jordan@example.com",
      customerPhone: "+1 (703) 555-0133",
      pickupAddress: "1961 Chain Bridge Rd, Tysons, VA",
      dropoffAddress: `${iad.name} (IAD)`,
      scheduledPickupAt: hoursFromNow(28),
      returnPickupAt: hoursFromNow(28 + 24 * 4),
      returnFlightNumber: "UA1187",
      passengers: 4,
      luggage: 4,
      childSeats: 1,
      paymentStatus: "paid",
      status: "confirmed",
    }),
    sampleBooking({
      bookingRef: "CE-DEMO03",
      serviceType: "hourly",
      vehicleSlug: "escalade",
      hoursBooked: 4,
      customerName: "Morgan Lee",
      customerEmail: "morgan@example.com",
      customerPhone: "+1 (301) 555-0177",
      pickupAddress: "The Willard InterContinental, 1401 Pennsylvania Ave NW, Washington, DC",
      scheduledPickupAt: hoursFromNow(50),
      isQuote: true,
      status: "pending",
    }),
  ];
  // Paid samples carry a final fare equal to the quote.
  for (const b of bookings) if (b.paymentStatus === "paid") b.finalFare = b.estimatedFare;

  return {
    version: 1,
    bookings,
    drivers: DEMO_DRIVERS.map((d) => ({ ...d, status: "available" })),
    vehicles: DEMO_VEHICLES.map((v) => ({
      ...v,
      vehicleClassId: demoVehicleClassId(v.vehicleSlug),
      vehicleSlug: v.vehicleSlug,
      driverId: v.driverId,
      status: "active",
    })),
    flatRateOverrides: {},
  };
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

let memoryDB: DemoDB | null = null;

export function loadDemoDB(): DemoDB {
  if (!hasStorage()) {
    memoryDB ??= seedDB();
    return memoryDB;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDB;
      if (parsed.version === 1 && Array.isArray(parsed.bookings)) return parsed;
    }
  } catch {
    // corrupted storage → reseed
  }
  const fresh = seedDB();
  saveDemoDB(fresh);
  return fresh;
}

export function saveDemoDB(db: DemoDB): void {
  memoryDB = db;
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // quota exceeded / private mode → keep in memory only
  }
}

export function resetDemoDB(): DemoDB {
  const fresh = seedDB();
  saveDemoDB(fresh);
  return fresh;
}

/** Subscribe to changes from this tab and other tabs. */
export function subscribeDemoDB(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function toView(db: DemoDB, b: Booking): BookingView {
  const driver = b.driverId ? db.drivers.find((d) => d.id === b.driverId) : undefined;
  const vehicle = b.vehicleId ? db.vehicles.find((v) => v.id === b.vehicleId) : undefined;
  return {
    ...b,
    driver: driver ? { id: driver.id, fullName: driver.fullName, phone: driver.phone } : null,
    vehicle: vehicle ? { id: vehicle.id, makeModel: vehicle.makeModel, plateNumber: vehicle.plateNumber } : null,
  };
}

export function demoInsertBooking(b: Booking): BookingView {
  const db = loadDemoDB();
  db.bookings.push(b);
  saveDemoDB(db);
  return toView(db, b);
}

export function demoUpdateBooking(id: string, patch: Partial<Booking>): BookingView | null {
  const db = loadDemoDB();
  const idx = db.bookings.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  db.bookings[idx] = { ...db.bookings[idx], ...patch };
  saveDemoDB(db);
  return toView(db, db.bookings[idx]);
}

export function demoFindByRef(ref: string): BookingView | null {
  const db = loadDemoDB();
  const b = db.bookings.find((x) => x.bookingRef.toUpperCase() === ref.trim().toUpperCase());
  return b ? toView(db, b) : null;
}

export function demoListBookings(): BookingView[] {
  const db = loadDemoDB();
  return [...db.bookings]
    .sort((a, b) => Date.parse(a.scheduledPickupAt) - Date.parse(b.scheduledPickupAt))
    .map((b) => toView(db, b));
}

export function demoAddDriver(input: Omit<Driver, "id" | "status">): Driver {
  const db = loadDemoDB();
  const driver: Driver = { ...input, id: `drv-${crypto.randomUUID().slice(0, 8)}`, status: "available" };
  db.drivers.push(driver);
  saveDemoDB(db);
  return driver;
}

export function demoSetFlatRate(key: string, fare: number): void {
  const db = loadDemoDB();
  db.flatRateOverrides = { ...db.flatRateOverrides, [key]: fare };
  saveDemoDB(db);
}

export function demoFlatRateOverrides(): Record<string, number> {
  return loadDemoDB().flatRateOverrides;
}

export function demoCatalog() {
  const overrides = demoFlatRateOverrides();
  return {
    vehicleClasses: seedVehicleClasses(),
    flatRates: seedFlatRates().map((r) => {
      const o = overrides[`${r.airportCode}|${r.cityZone}|${r.vehicleSlug}`];
      return typeof o === "number" ? { ...r, oneWayFare: o } : r;
    }),
  };
}
