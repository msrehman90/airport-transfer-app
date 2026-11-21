import { z } from "zod";
import {
  AIRPORTS,
  CITY_ZONES,
  MAX_CHILD_SEATS,
  MAX_HOURLY_HOURS,
  MIN_LEAD_TIME_MINUTES,
  VEHICLE_CLASSES,
  getAirport,
} from "./config";

export const OTHER_ZONE = "other";

const airportCodes = AIRPORTS.map((a) => a.code) as [string, ...string[]];
const zoneSlugs = [OTHER_ZONE, ...CITY_ZONES.map((z) => z.slug)] as [string, ...string[]];
const vehicleSlugs = VEHICLE_CLASSES.map((v) => v.slug) as [string, ...string[]];

const isoDate = z
  .string()
  .min(1, "Date and time are required")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date/time");

const flightNumber = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/\s+/g, ""))
  .refine((v) => v === "" || /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(v), "Use an airline code + number, e.g. UA1234");

/** Shared trip fields used for both quotes and bookings. */
export const tripSchema = z
  .object({
    serviceType: z.enum(["to_airport", "from_airport", "hourly", "point_to_point"]),
    tripType: z.enum(["one_way", "round_trip"]).default("one_way"),
    vehicleSlug: z.enum(vehicleSlugs),
    airportCode: z.enum(airportCodes).optional().nullable(),
    cityZone: z.enum(zoneSlugs).optional().nullable(),
    pickupAddress: z.string().trim().max(300).optional().default(""),
    dropoffAddress: z.string().trim().max(300).optional().default(""),
    hours: z.coerce.number().int().min(1).max(MAX_HOURLY_HOURS).optional().nullable(),
    passengers: z.coerce.number().int().min(1).max(60).default(1),
    luggage: z.coerce.number().int().min(0).max(60).default(0),
    meetAndGreet: z.boolean().default(false),
    childSeats: z.coerce.number().int().min(0).max(MAX_CHILD_SEATS).default(0),
    scheduledPickupAt: isoDate.optional().nullable(),
    returnPickupAt: isoDate.optional().nullable(),
    flightNumber: flightNumber.optional().nullable(),
    returnFlightNumber: flightNumber.optional().nullable(),
  })
  .superRefine((t, ctx) => {
    const isAirport = t.serviceType === "to_airport" || t.serviceType === "from_airport";
    if (isAirport) {
      if (!t.airportCode) ctx.addIssue({ code: "custom", path: ["airportCode"], message: "Choose an airport or station" });
      if (!t.cityZone) ctx.addIssue({ code: "custom", path: ["cityZone"], message: "Choose your city / area" });
      const addressField = t.serviceType === "to_airport" ? "pickupAddress" : "dropoffAddress";
      const address = t.serviceType === "to_airport" ? t.pickupAddress : t.dropoffAddress;
      if (t.cityZone === OTHER_ZONE && !address) {
        ctx.addIssue({ code: "custom", path: [addressField], message: "Enter the full address for distance pricing" });
      }
    }
    if (t.serviceType === "hourly") {
      if (!t.pickupAddress) ctx.addIssue({ code: "custom", path: ["pickupAddress"], message: "Enter a pickup address" });
      if (t.tripType === "round_trip") {
        ctx.addIssue({ code: "custom", path: ["tripType"], message: "Hourly service is booked one-way" });
      }
    }
    if (t.serviceType === "point_to_point") {
      if (!t.pickupAddress) ctx.addIssue({ code: "custom", path: ["pickupAddress"], message: "Enter a pickup address" });
      if (!t.dropoffAddress) ctx.addIssue({ code: "custom", path: ["dropoffAddress"], message: "Enter a drop-off address" });
    }
  });

export type TripInput = z.infer<typeof tripSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(30)
    .regex(/^[+()\d\s.-]+$/, "Enter a valid phone number"),
});

export const bookingSchema = z
  .object({
    trip: tripSchema,
    customer: customerSchema,
    notes: z.string().trim().max(1000).optional().default(""),
    mode: z.enum(["book", "quote"]).default("book"),
  })
  .superRefine((b, ctx) => {
    const t = b.trip;
    if (!t.scheduledPickupAt) {
      ctx.addIssue({ code: "custom", path: ["trip", "scheduledPickupAt"], message: "Choose a pickup date and time" });
      return;
    }
    const pickup = Date.parse(t.scheduledPickupAt);
    if (pickup < Date.now() + MIN_LEAD_TIME_MINUTES * 60_000) {
      ctx.addIssue({
        code: "custom",
        path: ["trip", "scheduledPickupAt"],
        message: `Pickups must be booked at least ${MIN_LEAD_TIME_MINUTES / 60} hours in advance`,
      });
    }
    const airport = getAirport(t.airportCode);
    if (t.serviceType === "from_airport" && airport?.kind === "airport" && !t.flightNumber) {
      ctx.addIssue({ code: "custom", path: ["trip", "flightNumber"], message: "Flight number is required for airport pickups" });
    }
    if (t.tripType === "round_trip" && t.serviceType !== "hourly") {
      if (!t.returnPickupAt) {
        ctx.addIssue({ code: "custom", path: ["trip", "returnPickupAt"], message: "Choose a return date and time" });
      } else if (Date.parse(t.returnPickupAt) <= pickup) {
        ctx.addIssue({ code: "custom", path: ["trip", "returnPickupAt"], message: "Return must be after the first pickup" });
      }
      // Return leg of a "to airport" trip is a pickup at the airport → needs the return flight.
      if (t.serviceType === "to_airport" && airport?.kind === "airport" && !t.returnFlightNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["trip", "returnFlightNumber"],
          message: "Return flight number is required for the airport pickup",
        });
      }
    }
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export const lookupSchema = z.object({
  bookingRef: z.string().trim().toUpperCase().min(4).max(20),
  contact: z.string().trim().toLowerCase().min(4).max(120),
});

export const cancelSchema = z.object({
  contact: z.string().trim().toLowerCase().min(4).max(120),
});

export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? issue.message : "Invalid request";
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => p !== "booking" && p !== "trip" && p !== "customer").join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Matches a contact string (email or phone) against a booking's details. */
export function contactMatches(contact: string, email: string, phone: string): boolean {
  const c = contact.trim().toLowerCase();
  if (c.includes("@")) return c === email.trim().toLowerCase();
  const digits = (s: string) => s.replace(/\D/g, "");
  const cd = digits(c);
  const pd = digits(phone);
  return cd.length >= 7 && pd.length >= 7 && (pd.endsWith(cd) || cd.endsWith(pd));
}
