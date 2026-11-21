import "server-only";
import { CHILD_SEAT_FEE, MEET_AND_GREET_FEE, getAirport, getZone } from "../config";
import { calculateQuote } from "../pricing";
import type { QuoteLineItem, QuoteResult } from "../types";
import { OTHER_ZONE, type TripInput } from "../validation";
import { DistanceError, getDrivingDistanceMiles } from "./distance";
import { findFlatRate, getVehicleClasses } from "./repo";

export class QuoteError extends Error {
  status: number;
  field?: string;
  constructor(message: string, field?: string, status = 400) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export interface ResolveQuoteOptions {
  /** Require full customer addresses (true when creating a booking). */
  requireAddresses?: boolean;
  /**
   * Demo Mode only: flat-rate overrides edited in the LocalStorage admin.
   * Ignored whenever Supabase or Stripe is configured, so real payments can never use them.
   */
  demoFlatRateOverrides?: Record<string, number> | null;
}

export function flatRateKey(airportCode: string, cityZone: string, vehicleSlug: string): string {
  return `${airportCode}|${cityZone}|${vehicleSlug}`;
}

/**
 * Authoritative server-side quote: loads vehicle pricing and flat rates itself,
 * computes distance when needed and returns an itemised breakdown.
 */
export async function resolveQuote(trip: TripInput, options: ResolveQuoteOptions = {}): Promise<QuoteResult> {
  const vehicles = await getVehicleClasses();
  const vehicle = vehicles.find((v) => v.slug === trip.vehicleSlug);
  if (!vehicle) throw new QuoteError("That vehicle class is not available.", "vehicleSlug");

  if (trip.passengers > vehicle.maxPassengers) {
    throw new QuoteError(
      `${vehicle.name} seats up to ${vehicle.maxPassengers} passengers. Choose a larger vehicle.`,
      "passengers",
    );
  }
  if (trip.luggage > vehicle.maxLuggage) {
    throw new QuoteError(
      `${vehicle.name} fits up to ${vehicle.maxLuggage} large bags. Choose a larger vehicle.`,
      "luggage",
    );
  }

  let distanceMiles: number | null = null;
  let flatRateOneWay: number | null = null;
  let billableHours: number | null = null;
  let pickupAddress = trip.pickupAddress || "";
  let dropoffAddress: string | null = trip.dropoffAddress || null;
  let baseLabel = "";

  try {
    if (trip.serviceType === "hourly") {
      billableHours = Math.max(trip.hours ?? vehicle.minHours, vehicle.minHours);
      baseLabel = `${billableHours} hours × ${vehicle.name} ($${vehicle.hourlyRate}/hr, ${vehicle.minHours}h minimum)`;
    } else if (trip.serviceType === "to_airport" || trip.serviceType === "from_airport") {
      const airport = getAirport(trip.airportCode);
      if (!airport) throw new QuoteError("Choose an airport or station.", "airportCode");
      const toAirport = trip.serviceType === "to_airport";
      const customerAddress = (toAirport ? trip.pickupAddress : trip.dropoffAddress) || "";
      const zoneSlug = trip.cityZone || OTHER_ZONE;
      const zone = getZone(zoneSlug);

      if (options.requireAddresses && !customerAddress) {
        throw new QuoteError(
          toAirport ? "Enter your pickup address." : "Enter your drop-off address.",
          toAirport ? "pickupAddress" : "dropoffAddress",
        );
      }

      if (zone) {
        const override = options.demoFlatRateOverrides?.[flatRateKey(airport.code, zone.slug, vehicle.slug)];
        flatRateOneWay =
          typeof override === "number" && override > 0
            ? override
            : await findFlatRate(airport.code, zone.slug, vehicle.id);
        if (flatRateOneWay == null) {
          // No flat rate configured for this pair → distance pricing from the zone centre.
          const d = await getDrivingDistanceMiles({ lat: airport.lat, lng: airport.lng }, { lat: zone.lat, lng: zone.lng });
          distanceMiles = d.miles;
        }
      } else {
        if (!customerAddress) {
          throw new QuoteError("Enter the full address for distance pricing.", toAirport ? "pickupAddress" : "dropoffAddress");
        }
        const d = await getDrivingDistanceMiles({ lat: airport.lat, lng: airport.lng }, customerAddress);
        distanceMiles = d.miles;
      }

      const customerSide = customerAddress || (zone ? zone.name : "");
      const airportSide = `${airport.name} (${airport.code === "UNION_DC" ? "Union Station" : airport.code})`;
      pickupAddress = toAirport ? customerSide : airportSide;
      dropoffAddress = toAirport ? airportSide : customerSide;

      baseLabel =
        flatRateOneWay != null
          ? `Flat rate ${zone?.name ?? ""} ↔ ${airport.shortName} (${vehicle.name})`
          : `${vehicle.name}: $${vehicle.baseFare} base + ${distanceMiles} mi × $${vehicle.perMileRate}/mi`;
    } else {
      if (!trip.pickupAddress || !trip.dropoffAddress) {
        throw new QuoteError("Enter both pickup and drop-off addresses.", "pickupAddress");
      }
      const d = await getDrivingDistanceMiles(trip.pickupAddress, trip.dropoffAddress);
      distanceMiles = d.miles;
      baseLabel = `${vehicle.name}: $${vehicle.baseFare} base + ${distanceMiles} mi × $${vehicle.perMileRate}/mi`;
    }
  } catch (err) {
    if (err instanceof DistanceError) throw new QuoteError(err.message, "address", 422);
    throw err;
  }

  const breakdown = calculateQuote({
    serviceType: trip.serviceType,
    tripType: trip.tripType,
    hours: billableHours ?? undefined,
    distanceMiles: distanceMiles ?? undefined,
    flatRateOneWay,
    vehicle: {
      hourlyRate: vehicle.hourlyRate,
      minHours: vehicle.minHours,
      baseFare: vehicle.baseFare,
      perMileRate: vehicle.perMileRate,
    },
    meetAndGreet: trip.meetAndGreet,
    childSeats: trip.childSeats,
  });

  const lineItems: QuoteLineItem[] = [{ label: baseLabel, amount: breakdown.baseFare }];
  if (breakdown.tripMultiplier > 1) lineItems.push({ label: "Return trip", amount: breakdown.baseFare });
  if (trip.meetAndGreet) lineItems.push({ label: "Meet & Greet inside terminal", amount: MEET_AND_GREET_FEE });
  if (trip.childSeats > 0) {
    lineItems.push({ label: `Child safety seat × ${trip.childSeats}`, amount: trip.childSeats * CHILD_SEAT_FEE });
  }

  return {
    breakdown,
    lineItems,
    vehicle,
    distanceMiles,
    billableHours,
    flatRateOneWay,
    pickupAddress,
    dropoffAddress,
  };
}

/**
 * Re-prices a booking that is already stored in the database, using current
 * vehicle and flat-rate tables plus the server-computed distance saved at
 * booking time. Used before creating a Stripe PaymentIntent.
 */
export async function repriceStoredBooking(b: {
  serviceType: TripInput["serviceType"];
  tripType: TripInput["tripType"];
  vehicleSlug: string;
  airportCode: string | null;
  cityZone: string | null;
  hoursBooked: number | null;
  distanceMiles: number | null;
  meetAndGreet: boolean;
  childSeats: number;
}): Promise<number> {
  const vehicles = await getVehicleClasses();
  const vehicle = vehicles.find((v) => v.slug === b.vehicleSlug);
  if (!vehicle) throw new QuoteError("Vehicle class no longer available.", "vehicleSlug", 409);

  let flatRateOneWay: number | null = null;
  const isAirport = b.serviceType === "to_airport" || b.serviceType === "from_airport";
  if (isAirport && b.airportCode && b.cityZone && getZone(b.cityZone)) {
    flatRateOneWay = await findFlatRate(b.airportCode, b.cityZone, vehicle.id);
  }
  if (b.serviceType !== "hourly" && flatRateOneWay == null && b.distanceMiles == null) {
    throw new QuoteError("This booking is missing its trip distance. Please request a new quote.", "address", 409);
  }

  return calculateQuote({
    serviceType: b.serviceType,
    tripType: b.tripType,
    hours: b.hoursBooked ?? undefined,
    distanceMiles: b.distanceMiles ?? undefined,
    flatRateOneWay,
    vehicle: {
      hourlyRate: vehicle.hourlyRate,
      minHours: vehicle.minHours,
      baseFare: vehicle.baseFare,
      perMileRate: vehicle.perMileRate,
    },
    meetAndGreet: b.meetAndGreet,
    childSeats: b.childSeats,
  }).totalFare;
}
