import type { AirportCode, VehicleSlug } from "./config";
import type { QuoteBreakdown, ServiceType, TripType } from "./pricing";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "assigned"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface VehicleClass {
  id: string;
  slug: VehicleSlug;
  name: string;
  description: string;
  exampleModels: string;
  maxPassengers: number;
  maxLuggage: number;
  hourlyRate: number;
  minHours: number;
  baseFare: number;
  perMileRate: number;
}

export interface FlatRate {
  id: string;
  airportCode: AirportCode;
  cityZone: string;
  vehicleClassId: string;
  vehicleSlug: VehicleSlug;
  oneWayFare: number;
}

export interface Driver {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  licenseNumber: string | null;
  status: string;
}

export interface FleetVehicle {
  id: string;
  vehicleClassId: string;
  vehicleSlug: VehicleSlug;
  makeModel: string;
  plateNumber: string;
  year: number;
  driverId: string | null;
  status: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  serviceType: ServiceType;
  tripType: TripType;
  vehicleClassId: string;
  vehicleSlug: VehicleSlug;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  airportCode: AirportCode | null;
  cityZone: string | null;
  hoursBooked: number | null;
  passengers: number;
  luggage: number;
  scheduledPickupAt: string;
  adjustedPickupAt: string | null;
  flightNumber: string | null;
  flightStatus: string | null;
  returnPickupAt: string | null;
  returnFlightNumber: string | null;
  meetAndGreet: boolean;
  childSeats: number;
  notes: string | null;
  estimatedFare: number;
  finalFare: number | null;
  distanceMiles: number | null;
  pricingMethod: QuoteBreakdown["pricingMethod"] | null;
  isQuote: boolean;
  stripePaymentIntentId: string | null;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  driverId: string | null;
  vehicleId: string | null;
  refundAmount: number | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** Booking plus the joined driver/vehicle details shown to customers and drivers. */
export interface BookingView extends Booking {
  driver: Pick<Driver, "id" | "fullName" | "phone"> | null;
  vehicle: Pick<FleetVehicle, "id" | "makeModel" | "plateNumber"> | null;
}

export interface QuoteLineItem {
  label: string;
  amount: number;
}

export interface QuoteResult {
  breakdown: QuoteBreakdown;
  lineItems: QuoteLineItem[];
  vehicle: VehicleClass;
  distanceMiles: number | null;
  billableHours: number | null;
  flatRateOneWay: number | null;
  pickupAddress: string;
  dropoffAddress: string | null;
}

export interface FlightStatusResult {
  flightNumber: string;
  status: "scheduled" | "en-route" | "active" | "landed" | "delayed" | "cancelled" | "diverted" | "unknown";
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  arrivalAirport: string | null;
  delayMinutes: number | null;
  simulated: boolean;
}
