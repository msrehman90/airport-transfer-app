import { CHILD_SEAT_FEE, MEET_AND_GREET_FEE } from "./config";

export type ServiceType = "to_airport" | "from_airport" | "hourly" | "point_to_point";
export type TripType = "one_way" | "round_trip";

export interface VehiclePricingConfig {
  hourlyRate: number;
  minHours: number;
  baseFare: number;
  perMileRate: number;
}

export interface QuoteRequest {
  serviceType: ServiceType;
  tripType: TripType;
  hours?: number;
  distanceMiles?: number;
  flatRateOneWay?: number | null;
  vehicle: VehiclePricingConfig;
  meetAndGreet: boolean;
  childSeats: number;
}

export interface QuoteBreakdown {
  baseFare: number;
  tripMultiplier: number;
  extrasFee: number;
  totalFare: number;
  pricingMethod: "hourly" | "flat_rate" | "distance";
}

/**
 * Pure fare calculation. This is the only place prices are computed.
 * Server code (API routes) calls it with vehicle/flat-rate data it loaded itself,
 * so client-submitted totals are never trusted.
 */
export function calculateQuote(input: QuoteRequest): QuoteBreakdown {
  let baseFare = 0;
  let pricingMethod: QuoteBreakdown["pricingMethod"] = "distance";

  if (input.serviceType === "hourly") {
    const billableHours = Math.max(input.hours ?? input.vehicle.minHours, input.vehicle.minHours);
    baseFare = billableHours * input.vehicle.hourlyRate;
    pricingMethod = "hourly";
  } else if (
    (input.serviceType === "to_airport" || input.serviceType === "from_airport") &&
    input.flatRateOneWay != null
  ) {
    baseFare = input.flatRateOneWay;
    pricingMethod = "flat_rate";
  } else {
    const miles = Math.max(input.distanceMiles ?? 0, 0);
    baseFare = input.vehicle.baseFare + miles * input.vehicle.perMileRate;
    pricingMethod = "distance";
  }

  const tripMultiplier = input.serviceType !== "hourly" && input.tripType === "round_trip" ? 2 : 1;
  const extrasFee =
    (input.meetAndGreet ? MEET_AND_GREET_FEE : 0) + Math.max(input.childSeats, 0) * CHILD_SEAT_FEE;

  const totalFare = Number((baseFare * tripMultiplier + extrasFee).toFixed(2));

  return {
    baseFare: Number(baseFare.toFixed(2)),
    tripMultiplier,
    extrasFee,
    totalFare,
    pricingMethod,
  };
}

/** Converts a dollar amount to Stripe's integer cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function formatUSD(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
