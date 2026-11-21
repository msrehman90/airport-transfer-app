/**
 * Business configuration: brand, airports/stations, city zones, fleet seed data,
 * flat-rate matrix and policy constants.
 *
 * Everything here is the single source of truth for Demo Mode and for the seed
 * data in supabase/schema.sql. To serve a different city, edit AIRPORTS, CITY_ZONES
 * and SEDAN_FLAT_RATES (and re-run the seed SQL).
 */

export const BRAND = {
  /** Prefix for booking references, e.g. PR-7K4QX2. */
  refPrefix: "PR",
  name: "Premium Rentals",
  shortName: "Premium Rentals",
  tagline: "Flat-rate luxury airport transfers across the DC, Maryland & Virginia region.",
  phone: "+1 (571) 241-0295",
  email: "reservations@premiumrentals.example",
  serviceArea: "Washington DC · Northern Virginia · Maryland",
} as const;

export const MEET_AND_GREET_FEE = 25;
export const CHILD_SEAT_FEE = 15;
export const MAX_CHILD_SEATS = 3;
export const FREE_CANCELLATION_HOURS = 24;
/** Minimum lead time between "now" and a requested pickup. */
export const MIN_LEAD_TIME_MINUTES = 120;
/** Flight time difference that triggers a pickup adjustment. */
export const FLIGHT_ADJUST_THRESHOLD_MINUTES = 10;
/** How far ahead the flight cron looks for arrivals. */
export const FLIGHT_LOOKAHEAD_HOURS = 6;
export const MAX_HOURLY_HOURS = 24;

export type AirportCode = "DCA" | "IAD" | "BWI" | "UNION_DC";

export interface AirportConfig {
  code: AirportCode;
  name: string;
  shortName: string;
  kind: "airport" | "station";
  address: string;
  lat: number;
  lng: number;
}

export const AIRPORTS: AirportConfig[] = [
  {
    code: "DCA",
    name: "Ronald Reagan Washington National Airport",
    shortName: "Reagan National (DCA)",
    kind: "airport",
    address: "2401 Smith Blvd, Arlington, VA 22202",
    lat: 38.8512,
    lng: -77.0402,
  },
  {
    code: "IAD",
    name: "Washington Dulles International Airport",
    shortName: "Dulles (IAD)",
    kind: "airport",
    address: "1 Saarinen Cir, Dulles, VA 20166",
    lat: 38.9531,
    lng: -77.4565,
  },
  {
    code: "BWI",
    name: "Baltimore/Washington International Airport",
    shortName: "BWI Marshall (BWI)",
    kind: "airport",
    address: "7035 Elm Rd, Baltimore, MD 21240",
    lat: 39.1774,
    lng: -76.6684,
  },
  {
    code: "UNION_DC",
    name: "Union Station, Washington DC",
    shortName: "Union Station (DC)",
    kind: "station",
    address: "50 Massachusetts Ave NE, Washington, DC 20002",
    lat: 38.8973,
    lng: -77.0063,
  },
];

export interface CityZone {
  slug: string;
  name: string;
  state: "DC" | "VA" | "MD";
  lat: number;
  lng: number;
}

export const CITY_ZONES: CityZone[] = [
  { slug: "dc_downtown", name: "Washington DC (Downtown / Capitol Hill)", state: "DC", lat: 38.9007, lng: -77.0367 },
  { slug: "arlington", name: "Arlington / Crystal City", state: "VA", lat: 38.8816, lng: -77.091 },
  { slug: "alexandria", name: "Alexandria / Old Town", state: "VA", lat: 38.8048, lng: -77.0469 },
  { slug: "tysons", name: "Tysons / McLean / Vienna", state: "VA", lat: 38.9187, lng: -77.2311 },
  { slug: "reston", name: "Reston / Herndon", state: "VA", lat: 38.9586, lng: -77.357 },
  { slug: "fairfax", name: "Fairfax / Chantilly", state: "VA", lat: 38.8462, lng: -77.3064 },
  { slug: "manassas", name: "Manassas / Gainesville", state: "VA", lat: 38.7509, lng: -77.4753 },
  { slug: "bethesda", name: "Bethesda / Chevy Chase", state: "MD", lat: 38.9847, lng: -77.0947 },
  { slug: "silver_spring", name: "Silver Spring / Takoma Park", state: "MD", lat: 38.9907, lng: -77.0261 },
  { slug: "rockville", name: "Rockville / Gaithersburg", state: "MD", lat: 39.084, lng: -77.1528 },
  { slug: "columbia", name: "Columbia / Ellicott City", state: "MD", lat: 39.2037, lng: -76.861 },
  { slug: "annapolis", name: "Annapolis", state: "MD", lat: 38.9784, lng: -76.4922 },
  { slug: "baltimore", name: "Baltimore (Inner Harbor / Downtown)", state: "MD", lat: 39.2858, lng: -76.6131 },
];

export type VehicleSlug = "sedan" | "suv" | "escalade" | "sprinter";

export interface VehicleClassSeed {
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
  /** Multiplier applied to the sedan flat-rate matrix (rounded to the nearest $5). */
  flatRateMultiplier: number;
}

export const VEHICLE_CLASSES: VehicleClassSeed[] = [
  {
    slug: "sedan",
    name: "Luxury Sedan",
    description: "Quiet, refined comfort for solo travelers and couples.",
    exampleModels: "Volvo S90, Mercedes E-Class or similar",
    maxPassengers: 4,
    maxLuggage: 2,
    hourlyRate: 70,
    minHours: 3,
    baseFare: 45,
    perMileRate: 3.5,
    flatRateMultiplier: 1,
  },
  {
    slug: "suv",
    name: "Executive SUV",
    description: "Room for the whole family and their luggage.",
    exampleModels: "Lexus LX, Chevrolet Suburban or similar",
    maxPassengers: 6,
    maxLuggage: 5,
    hourlyRate: 90,
    minHours: 3,
    baseFare: 65,
    perMileRate: 4.25,
    flatRateMultiplier: 1.3,
  },
  {
    slug: "escalade",
    name: "Cadillac Escalade",
    description: "Flagship luxury with first-class presence.",
    exampleModels: "Cadillac Escalade or similar",
    maxPassengers: 6,
    maxLuggage: 5,
    hourlyRate: 110,
    minHours: 3,
    baseFare: 85,
    perMileRate: 5,
    flatRateMultiplier: 1.6,
  },
  {
    slug: "sprinter",
    name: "Mercedes Sprinter",
    description: "Executive van for groups, teams and events.",
    exampleModels: "Mercedes-Benz Sprinter or similar",
    maxPassengers: 13,
    maxLuggage: 10,
    hourlyRate: 145,
    minHours: 3,
    baseFare: 120,
    perMileRate: 6.5,
    flatRateMultiplier: 2.2,
  },
];

/** One-way Luxury Sedan flat rates (USD) by city zone and airport/station. */
export const SEDAN_FLAT_RATES: Record<string, Record<AirportCode, number>> = {
  dc_downtown: { DCA: 65, IAD: 95, BWI: 110, UNION_DC: 45 },
  arlington: { DCA: 60, IAD: 90, BWI: 115, UNION_DC: 50 },
  alexandria: { DCA: 60, IAD: 100, BWI: 120, UNION_DC: 60 },
  tysons: { DCA: 75, IAD: 75, BWI: 125, UNION_DC: 80 },
  reston: { DCA: 90, IAD: 65, BWI: 140, UNION_DC: 95 },
  fairfax: { DCA: 85, IAD: 75, BWI: 135, UNION_DC: 90 },
  manassas: { DCA: 110, IAD: 90, BWI: 160, UNION_DC: 115 },
  bethesda: { DCA: 75, IAD: 95, BWI: 115, UNION_DC: 70 },
  silver_spring: { DCA: 75, IAD: 105, BWI: 100, UNION_DC: 65 },
  rockville: { DCA: 90, IAD: 95, BWI: 120, UNION_DC: 85 },
  columbia: { DCA: 115, IAD: 135, BWI: 75, UNION_DC: 105 },
  annapolis: { DCA: 115, IAD: 155, BWI: 90, UNION_DC: 115 },
  baltimore: { DCA: 125, IAD: 155, BWI: 65, UNION_DC: 125 },
};

export interface FlatRateRow {
  airportCode: AirportCode;
  cityZone: string;
  vehicleSlug: VehicleSlug;
  oneWayFare: number;
}

export function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

/** Expands the sedan matrix into a full (airport, zone, vehicle) flat-rate table. */
export function buildDefaultFlatRates(): FlatRateRow[] {
  const rows: FlatRateRow[] = [];
  for (const zone of CITY_ZONES) {
    const sedanRates = SEDAN_FLAT_RATES[zone.slug];
    if (!sedanRates) continue;
    for (const airport of AIRPORTS) {
      const sedanFare = sedanRates[airport.code];
      for (const vehicle of VEHICLE_CLASSES) {
        rows.push({
          airportCode: airport.code,
          cityZone: zone.slug,
          vehicleSlug: vehicle.slug,
          oneWayFare: roundToNearest5(sedanFare * vehicle.flatRateMultiplier),
        });
      }
    }
  }
  return rows;
}

export const DEFAULT_FLAT_RATES: FlatRateRow[] = buildDefaultFlatRates();

export function getAirport(code: string | null | undefined): AirportConfig | undefined {
  return AIRPORTS.find((a) => a.code === code);
}

export function getZone(slug: string | null | undefined): CityZone | undefined {
  return CITY_ZONES.find((z) => z.slug === slug);
}

export function getVehicleSeed(slug: string | null | undefined): VehicleClassSeed | undefined {
  return VEHICLE_CLASSES.find((v) => v.slug === slug);
}

export const SERVICE_TYPE_LABELS = {
  to_airport: "To the Airport / Station",
  from_airport: "From the Airport / Station",
  hourly: "Hourly Chauffeur",
  point_to_point: "Point-to-Point",
} as const;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const BOOKING_STATUS_LABELS: Record<(typeof BOOKING_STATUSES)[number], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Driver Assigned",
  en_route: "Driver En Route",
  arrived: "Driver Arrived",
  in_progress: "On Board",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;

export const DEMO_DRIVERS = [
  { id: "drv-demo-1", fullName: "Marcus Reed", phone: "+1 (202) 555-0181", email: "marcus@example.com", licenseNumber: "DC-44817-MR" },
  { id: "drv-demo-2", fullName: "Elena Vargas", phone: "+1 (703) 555-0122", email: "elena@example.com", licenseNumber: "VA-90211-EV" },
  { id: "drv-demo-3", fullName: "Daniel Okafor", phone: "+1 (301) 555-0164", email: "daniel@example.com", licenseNumber: "MD-55190-DO" },
] as const;

export const DEMO_VEHICLES = [
  { id: "veh-demo-1", vehicleSlug: "sedan", makeModel: "Mercedes-Benz E 450", plateNumber: "CEC-101", year: 2024, driverId: "drv-demo-1" },
  { id: "veh-demo-2", vehicleSlug: "suv", makeModel: "Chevrolet Suburban Premier", plateNumber: "CEC-202", year: 2024, driverId: "drv-demo-2" },
  { id: "veh-demo-3", vehicleSlug: "escalade", makeModel: "Cadillac Escalade ESV", plateNumber: "CEC-303", year: 2025, driverId: "drv-demo-3" },
  { id: "veh-demo-4", vehicleSlug: "sprinter", makeModel: "Mercedes-Benz Sprinter 3500", plateNumber: "CEC-404", year: 2023, driverId: null },
] as const;

/* ------------------------------------------------------------------------- */
/* Photography                                                               */
/* Local photos live in public/images/cars as <name>-<width>.webp.            */
/* Remote photos use the Unsplash CDN (Unsplash License: free commercial use). */
/* Swap entries here to change a photo.                                       */
/* ------------------------------------------------------------------------- */

export interface Photo {
  /** Local file base name in public/images/cars, e.g. "cadillac-escalade". */
  local?: string;
  /** Widths available for the local file (e.g. [800, 1200]). */
  widths?: number[];
  /** Unsplash image id, e.g. "1765461734605-34657fa04db2" (used when `local` is not set). */
  id?: string;
  alt: string;
  /** CSS object-position so the car stays in frame when cropped. */
  position?: string;
}

export const HERO_PHOTO: Photo = {
  local: "bmw-emerald-suv",
  widths: [800, 1200],
  alt: "Emerald green luxury SUV parked in front of mountains at sunset",
  position: "40% 62%",
};

export const CTA_PHOTO: Photo = {
  local: "bmw-dusk",
  widths: [800, 1350],
  alt: "Silver luxury SUV driving on an open road at dusk",
  position: "50% 70%",
};

export const VEHICLE_PHOTOS: Record<VehicleSlug, Photo> = {
  sedan: {
    local: "volvo-s90",
    widths: [524],
    alt: "White luxury sedan on a city street",
    position: "45% 60%",
  },
  suv: {
    local: "lexus-lx",
    widths: [800, 1200],
    alt: "Grey full-size luxury SUV driving on a highway",
    position: "45% 62%",
  },
  escalade: {
    local: "cadillac-escalade",
    widths: [800, 1200],
    alt: "Black Cadillac Escalade driving on a desert highway",
    position: "55% 60%",
  },
  sprinter: {
    id: "1765461734605-34657fa04db2",
    alt: "Black Mercedes-Benz van with its headlights on",
    position: "50% 50%",
  },
};

/** Extra photos for the "experience" gallery on the home page. */
export const GALLERY_PHOTOS: (Photo & { caption: string })[] = [
  {
    local: "mercedes-gle-sunset",
    widths: [447],
    alt: "Dark grey Mercedes SUV coupe at sunset",
    position: "50% 55%",
    caption: "Evening arrivals",
  },
  {
    local: "volvo-xc90",
    widths: [750],
    alt: "Champagne luxury SUV parked on a city street",
    position: "40% 60%",
    caption: "Executive travel",
  },
  {
    local: "bmw-dusk",
    widths: [800, 1350],
    alt: "Silver luxury SUV driving at dusk",
    position: "50% 72%",
    caption: "Long-distance comfort",
  },
];

export function photoUrl(photo: Photo, width: number, quality = 75): string {
  if (photo.local) {
    const widths = photo.widths?.length ? photo.widths : [800];
    const best = widths.find((w) => w >= width) ?? widths[widths.length - 1];
    return `/images/cars/${photo.local}-${best}.webp`;
  }
  return `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

export function photoSrcSet(photo: Photo, widths: number[] = [480, 800, 1200, 1600, 2000]): string {
  if (photo.local) {
    return (photo.widths?.length ? photo.widths : [800]).map((w) => `/images/cars/${photo.local}-${w}.webp ${w}w`).join(", ");
  }
  return widths.map((w) => `${photoUrl(photo, w)} ${w}w`).join(", ");
}
