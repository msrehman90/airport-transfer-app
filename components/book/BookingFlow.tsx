"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  BadgeCheck,
  Mail,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Users,
} from "lucide-react";
import {
  AIRPORTS,
  CHILD_SEAT_FEE,
  CITY_ZONES,
  FREE_CANCELLATION_HOURS,
  MAX_CHILD_SEATS,
  MEET_AND_GREET_FEE,
  MIN_LEAD_TIME_MINUTES,
  SERVICE_TYPE_LABELS,
  VEHICLE_CLASSES,
  VEHICLE_PHOTOS,
  getAirport,
  getZone,
  type VehicleSlug,
} from "@/lib/config";
import { ApiError, LIVE_DATA, confirmPayment, createBooking, fetchQuote, startPayment, type PaymentStart } from "@/lib/client/api";
import { defaultPickupLocal, formatDateLong, isoToZonedLocal, zonedLocalToIso } from "@/lib/format";
import { formatUSD, type ServiceType, type TripType } from "@/lib/pricing";
import type { Booking, QuoteResult } from "@/lib/types";
import { OTHER_ZONE, type BookingInput, type TripInput } from "@/lib/validation";
import { AddressInput } from "../AddressInput";
import { Photo } from "../Photo";
import { Alert, Button, ButtonLink, Field, Spinner, cn } from "../ui";
import { StripePayment } from "./StripePayment";

interface FormState {
  serviceType: ServiceType;
  tripType: TripType;
  airportCode: string;
  cityZone: string;
  pickupAddress: string;
  dropoffAddress: string;
  hours: number;
  pickupLocal: string;
  returnLocal: string;
  vehicleSlug: VehicleSlug;
  passengers: number;
  luggage: number;
  meetAndGreet: boolean;
  childSeats: number;
  name: string;
  email: string;
  phone: string;
  flightNumber: string;
  returnFlightNumber: string;
  notes: string;
}

const STEPS = ["Trip Details", "Vehicle & Extras", "Contact & Flight", "Review & Pay"] as const;

const FIELD_STEP: Record<string, number> = {
  serviceType: 0,
  tripType: 0,
  airportCode: 0,
  cityZone: 0,
  pickupAddress: 0,
  dropoffAddress: 0,
  address: 0,
  hours: 0,
  scheduledPickupAt: 0,
  returnPickupAt: 0,
  vehicleSlug: 1,
  passengers: 1,
  luggage: 1,
  childSeats: 1,
  meetAndGreet: 1,
  name: 2,
  email: 2,
  phone: 2,
  flightNumber: 2,
  returnFlightNumber: 2,
  notes: 2,
};

const SERVICE_ICONS: Record<ServiceType, typeof PlaneTakeoff> = {
  to_airport: PlaneTakeoff,
  from_airport: PlaneLanding,
  hourly: Clock,
  point_to_point: Route,
};

function isAirportService(s: ServiceType) {
  return s === "to_airport" || s === "from_airport";
}

function initialState(params: URLSearchParams): FormState {
  const service = params.get("service");
  const vehicle = params.get("vehicle");
  const airport = params.get("airport");
  const zone = params.get("zone");
  const hours = Number(params.get("hours"));
  return {
    serviceType: (["to_airport", "from_airport", "hourly", "point_to_point"].includes(service ?? "") ? service : "to_airport") as ServiceType,
    tripType: "one_way",
    airportCode: getAirport(airport) ? airport! : "DCA",
    cityZone: zone === OTHER_ZONE || getZone(zone) ? zone! : "dc_downtown",
    pickupAddress: params.get("pickup") ?? "",
    dropoffAddress: params.get("dropoff") ?? "",
    hours: Number.isFinite(hours) && hours >= 3 ? Math.min(hours, 24) : 3,
    pickupLocal: defaultPickupLocal(1, 10),
    returnLocal: defaultPickupLocal(4, 16),
    vehicleSlug: (VEHICLE_CLASSES.some((v) => v.slug === vehicle) ? vehicle : "sedan") as VehicleSlug,
    passengers: 1,
    luggage: 1,
    meetAndGreet: false,
    childSeats: 0,
    name: "",
    email: "",
    phone: "",
    flightNumber: "",
    returnFlightNumber: "",
    notes: "",
  };
}

function toTrip(f: FormState, vehicleSlug: VehicleSlug = f.vehicleSlug): TripInput {
  const airport = isAirportService(f.serviceType);
  const roundTrip = f.serviceType !== "hourly" && f.tripType === "round_trip";
  return {
    serviceType: f.serviceType,
    tripType: f.serviceType === "hourly" ? "one_way" : f.tripType,
    vehicleSlug,
    airportCode: airport ? f.airportCode : null,
    cityZone: airport ? f.cityZone : null,
    pickupAddress: f.serviceType === "from_airport" ? "" : f.pickupAddress.trim(),
    dropoffAddress: f.serviceType === "to_airport" ? "" : f.dropoffAddress.trim(),
    hours: f.serviceType === "hourly" ? f.hours : null,
    passengers: f.passengers,
    luggage: f.luggage,
    meetAndGreet: airport ? f.meetAndGreet : false,
    childSeats: f.childSeats,
    scheduledPickupAt: zonedLocalToIso(f.pickupLocal),
    returnPickupAt: roundTrip ? zonedLocalToIso(f.returnLocal) : null,
    flightNumber: f.flightNumber.trim() || null,
    returnFlightNumber: roundTrip ? f.returnFlightNumber.trim() || null : null,
  };
}

function toBookingInput(f: FormState, mode: "book" | "quote"): BookingInput {
  return {
    trip: toTrip(f),
    customer: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() },
    notes: f.notes.trim(),
    mode,
  };
}

/** Light client-side checks per step; the server re-validates everything. */
function validateStep(step: number, f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    const airport = getAirport(f.airportCode);
    if (f.serviceType === "to_airport" && !f.pickupAddress.trim()) e.pickupAddress = "Enter your pickup address";
    if (f.serviceType === "from_airport" && !f.dropoffAddress.trim()) e.dropoffAddress = "Enter your drop-off address";
    if ((f.serviceType === "hourly" || f.serviceType === "point_to_point") && !f.pickupAddress.trim()) {
      e.pickupAddress = "Enter a pickup address";
    }
    if (f.serviceType === "point_to_point" && !f.dropoffAddress.trim()) e.dropoffAddress = "Enter a drop-off address";
    const pickupIso = zonedLocalToIso(f.pickupLocal);
    if (!pickupIso) e.scheduledPickupAt = "Choose a date and time";
    else if (Date.parse(pickupIso) < Date.now() + MIN_LEAD_TIME_MINUTES * 60_000) {
      e.scheduledPickupAt = `Please book at least ${MIN_LEAD_TIME_MINUTES / 60} hours ahead, or call us`;
    }
    if (f.serviceType !== "hourly" && f.tripType === "round_trip") {
      const ret = zonedLocalToIso(f.returnLocal);
      if (!ret) e.returnPickupAt = "Choose a return date and time";
      else if (pickupIso && Date.parse(ret) <= Date.parse(pickupIso)) e.returnPickupAt = "Return must be after the first pickup";
    }
    if (!airport && isAirportService(f.serviceType)) e.airportCode = "Choose an airport";
  }
  if (step === 1) {
    const v = VEHICLE_CLASSES.find((x) => x.slug === f.vehicleSlug)!;
    if (f.passengers > v.maxPassengers) e.passengers = `${v.name} seats up to ${v.maxPassengers}`;
    if (f.luggage > v.maxLuggage) e.luggage = `${v.name} fits up to ${v.maxLuggage} bags`;
  }
  if (step === 2) {
    if (f.name.trim().length < 2) e.name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email";
    if (f.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number";
    const airport = getAirport(f.airportCode);
    const flightRe = /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/;
    if (f.serviceType === "from_airport" && airport?.kind === "airport") {
      if (!f.flightNumber.trim()) e.flightNumber = "Flight number is required so we can track your arrival";
    }
    if (f.flightNumber.trim() && !flightRe.test(f.flightNumber.replace(/\s/g, "").toUpperCase())) {
      e.flightNumber = "Use an airline code + number, e.g. UA1234";
    }
    if (f.serviceType === "to_airport" && f.tripType === "round_trip" && airport?.kind === "airport" && !f.returnFlightNumber.trim()) {
      e.returnFlightNumber = "Return flight number is required for the airport pickup";
    }
  }
  return e;
}

export function BookingFlow() {
  const params = useSearchParams();
  const [form, setForm] = useState<FormState>(() => initialState(new URLSearchParams(params.toString())));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vehicleQuotes, setVehicleQuotes] = useState<Partial<Record<VehicleSlug, QuoteResult | string>>>({});
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"book" | "quote" | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<PaymentStart | null>(null);
  const [done, setDone] = useState<{ kind: "paid" | "quote"; booking: Booking; emailed: boolean } | null>(null);

  const airport = getAirport(form.airportCode);
  const isAirport = isAirportService(form.serviceType);
  const minLocal = useMemo(() => isoToZonedLocal(new Date(Date.now() + MIN_LEAD_TIME_MINUTES * 60_000).toISOString()), []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
    setQuote(null);
    setBooking(null);
    setPayment(null);
  }

  // Price every vehicle for the vehicle step (all prices come from the server).
  useEffect(() => {
    if (step !== 1) return;
    let active = true;
    setVehicleQuotes({});
    Promise.all(
      VEHICLE_CLASSES.map(async (v) => {
        try {
          const q = await fetchQuote({ ...toTrip(form, v.slug), passengers: 1, luggage: 0 });
          return [v.slug, q] as const;
        } catch (err) {
          return [v.slug, (err as Error).message] as const;
        }
      }),
    ).then((entries) => {
      if (active) setVehicleQuotes(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.serviceType, form.tripType, form.airportCode, form.cityZone, form.pickupAddress, form.dropoffAddress, form.hours, form.meetAndGreet, form.childSeats]);

  // Fresh authoritative quote for the review step.
  useEffect(() => {
    if (step !== 3 || quote) return;
    let active = true;
    setQuoteLoading(true);
    setFormError(null);
    fetchQuote(toTrip(form))
      .then((q) => active && setQuote(q))
      .catch((err: ApiError) => {
        if (!active) return;
        setFormError(err.message);
        jumpToErrors(err.fieldErrors);
      })
      .finally(() => active && setQuoteLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, quote]);

  function jumpToErrors(fieldErrors: Record<string, string>) {
    const keys = Object.keys(fieldErrors);
    if (keys.length === 0) return;
    setErrors(fieldErrors);
    const target = Math.min(...keys.map((k) => FIELD_STEP[k] ?? 3));
    if (target < 3) setStep(target);
  }

  function next() {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setFormError(null);
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit(mode: "book" | "quote") {
    for (let s = 0; s < 3; s++) {
      const e = validateStep(s, form);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    setSubmitting(mode);
    setFormError(null);
    try {
      const input = toBookingInput(form, mode);
      const result = booking && mode === "book" ? { booking, emailed: false } : await createBooking(input);
      if (mode === "quote") {
        setDone({ kind: "quote", booking: result.booking, emailed: result.emailed });
        return;
      }
      setBooking(result.booking);
      const pay = await startPayment(result.booking.bookingRef, input);
      setPayment(pay);
    } catch (err) {
      const e = err as ApiError;
      setFormError(e.message);
      if (e.fieldErrors) jumpToErrors(e.fieldErrors);
    } finally {
      setSubmitting(null);
    }
  }

  async function handlePaid(paymentIntentId: string | null) {
    if (!booking) return;
    const paid = await confirmPayment(booking.bookingRef, paymentIntentId);
    if (!paid) throw new Error("We couldn't confirm the payment yet. Check Manage Booking in a minute.");
    setDone({ kind: "paid", booking: { ...booking, paymentStatus: "paid", status: "confirmed" }, emailed: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) return <BookingDone done={done} />;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Booking steps">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => i < step && setStep(i)}
                className="group w-full text-left disabled:cursor-default"
                aria-current={i === step ? "step" : undefined}
              >
                <span className={cn("block h-1 rounded-full transition-colors", i <= step ? "bg-brand" : "bg-line")} />
                <span className={cn("mt-2 hidden text-xs sm:block", i === step ? "text-brand" : i < step ? "text-ivory-dim" : "text-muted")}>
                  {i + 1}. {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mb-6 text-sm text-brand sm:hidden">
          Step {step + 1} of 4 · {STEPS[step]}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="card-lux p-5 sm:p-8"
          >
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((s) => {
                    const Icon = SERVICE_ICONS[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          update("serviceType", s);
                          if (s === "hourly") update("tripType", "one_way");
                        }}
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors",
                          form.serviceType === s ? "border-brand bg-brand/10 text-ivory" : "border-line text-ivory-dim hover:border-brand/40",
                        )}
                        aria-pressed={form.serviceType === s}
                      >
                        <Icon className="h-5 w-5 text-brand" />
                        {SERVICE_TYPE_LABELS[s]}
                      </button>
                    );
                  })}
                </div>

                {form.serviceType !== "hourly" && (
                  <div className="flex gap-2" role="radiogroup" aria-label="Trip type">
                    {(["one_way", "round_trip"] as TripType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={form.tripType === t}
                        onClick={() => update("tripType", t)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm",
                          form.tripType === t ? "border-brand bg-brand text-ink" : "border-line text-ivory-dim hover:border-brand/40",
                        )}
                      >
                        {t === "one_way" ? "One way" : "Round trip"}
                      </button>
                    ))}
                  </div>
                )}

                {isAirport && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={form.serviceType === "to_airport" ? "Drop-off airport / station" : "Pickup airport / station"} htmlFor="airport" error={errors.airportCode}>
                      <select id="airport" className="input-lux" value={form.airportCode} onChange={(e) => update("airportCode", e.target.value)}>
                        {AIRPORTS.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="City / area" htmlFor="zone" error={errors.cityZone} hint="Listed areas have a flat rate">
                      <select id="zone" className="input-lux" value={form.cityZone} onChange={(e) => update("cityZone", e.target.value)}>
                        {CITY_ZONES.map((z) => (
                          <option key={z.slug} value={z.slug}>
                            {z.name}
                          </option>
                        ))}
                        <option value={OTHER_ZONE}>Other address (priced by distance)</option>
                      </select>
                    </Field>
                    <Field
                      label={form.serviceType === "to_airport" ? "Pickup address" : "Drop-off address"}
                      htmlFor="customer-address"
                      className="sm:col-span-2"
                      error={form.serviceType === "to_airport" ? errors.pickupAddress ?? errors.address : errors.dropoffAddress ?? errors.address}
                    >
                      <AddressInput
                        id="customer-address"
                        value={form.serviceType === "to_airport" ? form.pickupAddress : form.dropoffAddress}
                        onChange={(v) => update(form.serviceType === "to_airport" ? "pickupAddress" : "dropoffAddress", v)}
                        invalid={Boolean(errors.pickupAddress || errors.dropoffAddress || errors.address)}
                        required
                      />
                    </Field>
                  </div>
                )}

                {form.serviceType === "hourly" && (
                  <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                    <Field label="Pickup address" htmlFor="h-pickup" error={errors.pickupAddress}>
                      <AddressInput id="h-pickup" value={form.pickupAddress} onChange={(v) => update("pickupAddress", v)} invalid={Boolean(errors.pickupAddress)} required />
                    </Field>
                    <Field label="Hours" htmlFor="h-hours" error={errors.hours} hint="3-hour minimum, 25 mi/hr included">
                      <select id="h-hours" className="input-lux" value={form.hours} onChange={(e) => update("hours", Number(e.target.value))}>
                        {Array.from({ length: 22 }, (_, i) => i + 3).map((h) => (
                          <option key={h} value={h}>
                            {h} hours
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Final drop-off (optional)" htmlFor="h-drop" className="sm:col-span-2">
                      <AddressInput id="h-drop" value={form.dropoffAddress} onChange={(v) => update("dropoffAddress", v)} placeholder="Leave blank if same as pickup" />
                    </Field>
                  </div>
                )}

                {form.serviceType === "point_to_point" && (
                  <div className="grid gap-4">
                    <Field label="Pickup address" htmlFor="p-from" error={errors.pickupAddress ?? errors.address}>
                      <AddressInput id="p-from" value={form.pickupAddress} onChange={(v) => update("pickupAddress", v)} invalid={Boolean(errors.pickupAddress)} required />
                    </Field>
                    <Field label="Drop-off address" htmlFor="p-to" error={errors.dropoffAddress}>
                      <AddressInput id="p-to" value={form.dropoffAddress} onChange={(v) => update("dropoffAddress", v)} invalid={Boolean(errors.dropoffAddress)} required />
                    </Field>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={form.serviceType === "from_airport" ? "Flight arrival (pickup) time" : "Pickup date & time"}
                    htmlFor="pickup-time"
                    error={errors.scheduledPickupAt}
                    hint="Eastern Time (Washington DC)"
                  >
                    <input
                      id="pickup-time"
                      type="datetime-local"
                      className="input-lux"
                      min={minLocal}
                      step={900}
                      value={form.pickupLocal}
                      onChange={(e) => update("pickupLocal", e.target.value)}
                      required
                    />
                  </Field>
                  {form.serviceType !== "hourly" && form.tripType === "round_trip" && (
                    <Field
                      label={form.serviceType === "to_airport" ? "Return flight arrival time" : "Return pickup date & time"}
                      htmlFor="return-time"
                      error={errors.returnPickupAt}
                      hint="Eastern Time (Washington DC)"
                    >
                      <input
                        id="return-time"
                        type="datetime-local"
                        className="input-lux"
                        min={form.pickupLocal || minLocal}
                        step={900}
                        value={form.returnLocal}
                        onChange={(e) => update("returnLocal", e.target.value)}
                        required
                      />
                    </Field>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {VEHICLE_CLASSES.map((v) => {
                    const q = vehicleQuotes[v.slug];
                    const selected = form.vehicleSlug === v.slug;
                    const tooSmall = form.passengers > v.maxPassengers || form.luggage > v.maxLuggage;
                    return (
                      <button
                        key={v.slug}
                        type="button"
                        onClick={() => update("vehicleSlug", v.slug)}
                        aria-pressed={selected}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border text-left transition-colors",
                          selected ? "border-brand bg-brand/[0.07] ring-1 ring-brand/50" : "border-line hover:border-steel-light/50",
                          tooSmall && "opacity-60",
                        )}
                      >
                        {selected && (
                          <span className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-brand text-white shadow-lg">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        <div className="relative h-36 overflow-hidden">
                          <Photo
                            photo={VEHICLE_PHOTOS[v.slug]}
                            sizes="(min-width: 640px) 320px, 100vw"
                            className="transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
                        </div>
                        <div className="px-4 pb-4">
                        <p className="-mt-3 relative font-serif text-xl text-ivory">{v.name}</p>
                        <p className="text-xs text-muted">{v.exampleModels}</p>
                        <div className="mt-3 flex items-end justify-between">
                          <span className="flex gap-3 text-xs text-ivory-dim">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-brand" /> {v.maxPassengers}
                            </span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5 text-brand" /> {v.maxLuggage}
                            </span>
                          </span>
                          <span className="text-right">
                            {q === undefined ? (
                              <Spinner className="h-4 w-4" />
                            ) : typeof q === "string" ? (
                              <span className="text-xs text-danger">Unavailable</span>
                            ) : (
                              <span className="font-semibold text-brand-light">{formatUSD(q.breakdown.totalFare)}</span>
                            )}
                          </span>
                        </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {Object.values(vehicleQuotes).every((q) => typeof q === "string") && Object.keys(vehicleQuotes).length > 0 && (
                  <Alert tone="error">{String(Object.values(vehicleQuotes)[0])}</Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Passengers" htmlFor="pax" error={errors.passengers}>
                    <select id="pax" className="input-lux" value={form.passengers} onChange={(e) => update("passengers", Number(e.target.value))}>
                      {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Large bags" htmlFor="bags" error={errors.luggage}>
                    <select id="bags" className="input-lux" value={form.luggage} onChange={(e) => update("luggage", Number(e.target.value))}>
                      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Child seats (+$${CHILD_SEAT_FEE} each)`} htmlFor="seats" error={errors.childSeats}>
                    <select id="seats" className="input-lux" value={form.childSeats} onChange={(e) => update("childSeats", Number(e.target.value))}>
                      {Array.from({ length: MAX_CHILD_SEATS + 1 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {isAirport && (
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors",
                      form.meetAndGreet ? "border-brand bg-brand/[0.07]" : "border-line hover:border-brand/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[#10b981]"
                      checked={form.meetAndGreet}
                      onChange={(e) => update("meetAndGreet", e.target.checked)}
                    />
                    <span>
                      <span className="flex items-center gap-2 font-medium text-ivory">
                        <BadgeCheck className="h-4 w-4 text-brand" /> Meet & Greet inside the terminal{" "}
                        <span className="text-brand">+${MEET_AND_GREET_FEE}</span>
                      </span>
                      <span className="mt-1 block text-sm text-ivory-dim">
                        Your chauffeur waits at baggage claim with a name sign and helps with your luggage.
                      </span>
                    </span>
                  </label>
                )}
                {form.childSeats > 0 && (
                  <p className="flex items-center gap-2 text-xs text-ivory-dim">
                    <Baby className="h-4 w-4 text-brand" /> Tell us the children&apos;s ages in the notes on the next step.
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="name" error={errors.name} className="sm:col-span-2">
                    <input id="name" className="input-lux" autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
                  </Field>
                  <Field label="Email" htmlFor="email" error={errors.email}>
                    <input id="email" type="email" className="input-lux" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
                  </Field>
                  <Field label="Mobile phone" htmlFor="phone" error={errors.phone} hint="Your chauffeur will text this number">
                    <input id="phone" type="tel" className="input-lux" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
                  </Field>
                </div>

                {(form.serviceType === "from_airport" || (form.serviceType === "to_airport" && form.tripType === "round_trip")) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {form.serviceType === "from_airport" && (
                      <Field
                        label={airport?.kind === "station" ? "Train number (optional)" : "Arriving flight number"}
                        htmlFor="flight"
                        error={errors.flightNumber}
                        hint="We track it and adjust pickup for delays"
                      >
                        <input
                          id="flight"
                          className="input-lux uppercase"
                          placeholder="e.g. UA1234"
                          value={form.flightNumber}
                          onChange={(e) => update("flightNumber", e.target.value.toUpperCase())}
                        />
                      </Field>
                    )}
                    {form.serviceType === "to_airport" && form.tripType === "round_trip" && (
                      <Field
                        label={airport?.kind === "station" ? "Return train number (optional)" : "Return flight number"}
                        htmlFor="return-flight"
                        error={errors.returnFlightNumber}
                        hint="For your pickup on the way back"
                      >
                        <input
                          id="return-flight"
                          className="input-lux uppercase"
                          placeholder="e.g. AA2142"
                          value={form.returnFlightNumber}
                          onChange={(e) => update("returnFlightNumber", e.target.value.toUpperCase())}
                        />
                      </Field>
                    )}
                  </div>
                )}

                <Field label="Notes for your chauffeur (optional)" htmlFor="notes" error={errors.notes}>
                  <textarea
                    id="notes"
                    rows={3}
                    className="input-lux resize-none"
                    placeholder="Gate code, child ages, special requests…"
                    value={form.notes}
                    maxLength={1000}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <ReviewSummary form={form} />
                {quoteLoading && (
                  <div className="flex items-center gap-3 text-sm text-ivory-dim">
                    <Spinner className="h-4 w-4" /> Calculating your fare…
                  </div>
                )}
                {quote && <QuoteBreakdownCard quote={quote} />}

                {payment && booking ? (
                  <div className="rounded-2xl border border-brand/40 p-5">
                    <p className="mb-4 flex items-center gap-2 text-sm text-ivory-dim">
                      <CreditCard className="h-4 w-4 text-brand" /> Booking <span className="font-semibold text-ivory">{booking.bookingRef}</span> is
                      held. Complete payment to confirm.
                    </p>
                    {payment.demo ? (
                      <DemoPayment amount={payment.amount} onPay={() => handlePaid(null)} />
                    ) : payment.clientSecret ? (
                      <StripePayment
                        clientSecret={payment.clientSecret}
                        amount={payment.amount}
                        bookingRef={booking.bookingRef}
                        onPaid={(id) => handlePaid(id)}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" className="flex-1" onClick={() => submit("book")} loading={submitting === "book"} disabled={!quote || submitting !== null}>
                      Book now <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1"
                      onClick={() => submit("quote")}
                      loading={submitting === "quote"}
                      disabled={!quote || submitting !== null}
                    >
                      <Mail className="h-4 w-4" /> Email me this quote
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted">
                  Free cancellation up to {FREE_CANCELLATION_HOURS} hours before pickup. If your airline cancels your flight, you get a 100%
                  refund or free rebooking.
                </p>
              </div>
            )}

            {formError && (
              <div className="mt-6">
                <Alert tone="error">{formError}</Alert>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
              {step > 0 && !payment ? (
                <Button variant="ghost" onClick={back}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < 3 && (
                <Button onClick={next}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SidebarSummary form={form} quote={quote ?? (vehicleQuotes[form.vehicleSlug] as QuoteResult | undefined) ?? null} />
      </aside>
    </div>
  );
}

function tripLines(form: FormState): [string, string][] {
  const airport = getAirport(form.airportCode);
  const zone = getZone(form.cityZone);
  const lines: [string, string][] = [["Service", SERVICE_TYPE_LABELS[form.serviceType]]];
  if (form.serviceType !== "hourly") lines.push(["Trip", form.tripType === "round_trip" ? "Round trip" : "One way"]);
  if (form.serviceType === "to_airport") {
    lines.push(["From", form.pickupAddress || zone?.name || "—"], ["To", airport?.name ?? "—"]);
  } else if (form.serviceType === "from_airport") {
    lines.push(["From", airport?.name ?? "—"], ["To", form.dropoffAddress || zone?.name || "—"]);
  } else {
    lines.push(["Pickup", form.pickupAddress || "—"]);
    if (form.dropoffAddress) lines.push(["Drop-off", form.dropoffAddress]);
    if (form.serviceType === "hourly") lines.push(["Duration", `${form.hours} hours`]);
  }
  const pickupIso = zonedLocalToIso(form.pickupLocal);
  lines.push(["Pickup time", pickupIso ? formatDateLong(pickupIso) : "—"]);
  if (form.serviceType !== "hourly" && form.tripType === "round_trip") {
    const ret = zonedLocalToIso(form.returnLocal);
    lines.push(["Return", ret ? formatDateLong(ret) : "—"]);
  }
  return lines;
}

function ReviewSummary({ form }: { form: FormState }) {
  const v = VEHICLE_CLASSES.find((x) => x.slug === form.vehicleSlug)!;
  const lines = [
    ...tripLines(form),
    ["Vehicle", v.name],
    ["Passengers / bags", `${form.passengers} / ${form.luggage}`],
    ["Name", form.name],
    ["Contact", `${form.email} · ${form.phone}`],
    ...(form.flightNumber ? [["Flight", form.flightNumber] as [string, string]] : []),
    ...(form.returnFlightNumber && form.tripType === "round_trip" ? [["Return flight", form.returnFlightNumber] as [string, string]] : []),
  ] as [string, string][];
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {lines.map(([k, val]) => (
        <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-2.5 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="text-ivory">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

function QuoteBreakdownCard({ quote }: { quote: QuoteResult }) {
  return (
    <div className="rounded-xl border border-brand/30 bg-brand/[0.04] p-4">
      <ul className="space-y-2 text-sm">
        {quote.lineItems.map((li) => (
          <li key={li.label} className="flex justify-between gap-4">
            <span className="text-ivory-dim">{li.label}</span>
            <span className="tabular-nums text-ivory">{formatUSD(li.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-brand/30 pt-3">
        <span className="text-sm uppercase tracking-wider text-brand">Total</span>
        <span className="font-serif text-3xl text-brand">{formatUSD(quote.breakdown.totalFare)}</span>
      </div>
    </div>
  );
}

function SidebarSummary({ form, quote }: { form: FormState; quote: QuoteResult | null }) {
  const v = VEHICLE_CLASSES.find((x) => x.slug === form.vehicleSlug)!;
  return (
    <div className="card-lux p-5">
      <p className="eyebrow">Your ride</p>
      <div className="relative mt-3 h-36 overflow-hidden rounded-xl">
        <Photo photo={VEHICLE_PHOTOS[v.slug]} sizes="360px" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel/80 to-transparent" />
      </div>
      <p className="mt-2 font-serif text-2xl text-ivory">{v.name}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {tripLines(form).map(([k, val]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right text-ivory-dim">{val}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-xs uppercase tracking-wider text-muted">Estimated total</span>
        <span className="font-serif text-2xl text-brand">{quote ? formatUSD(quote.breakdown.totalFare) : "—"}</span>
      </div>
      <p className="mt-3 text-xs text-muted">Final price is confirmed on the server before payment.</p>
    </div>
  );
}

function DemoPayment({ amount, onPay }: { amount: number; onPay: () => Promise<void> }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Demo payment: Stripe keys are not set, so no card is charged. Add Stripe test keys to <code>.env.local</code> to see the real
        checkout.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-[1fr_90px_70px]">
        <input className="input-lux" value="4242 4242 4242 4242" readOnly aria-label="Demo card number" />
        <input className="input-lux" value="12 / 34" readOnly aria-label="Demo expiry" />
        <input className="input-lux" value="123" readOnly aria-label="Demo CVC" />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        size="lg"
        className="w-full"
        loading={paying}
        onClick={async () => {
          setPaying(true);
          setError(null);
          try {
            await onPay();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setPaying(false);
          }
        }}
      >
        Pay {formatUSD(amount)} (demo)
      </Button>
    </div>
  );
}

function BookingDone({ done }: { done: { kind: "paid" | "quote"; booking: Booking; emailed: boolean } }) {
  const b = done.booking;
  const trackHref = `/track?ref=${encodeURIComponent(b.bookingRef)}&contact=${encodeURIComponent(b.customerEmail)}`;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card-lux mx-auto max-w-2xl p-8 text-center sm:p-12">
      <CheckCircle2 className="mx-auto h-14 w-14 text-brand" />
      <h2 className="heading-lux mt-5 text-4xl">{done.kind === "paid" ? "Your ride is confirmed" : "Your quote is saved"}</h2>
      <p className="mt-3 text-ivory-dim">
        {done.kind === "paid"
          ? "Thank you. Your chauffeur will be assigned shortly and will text you on the day."
          : LIVE_DATA && done.emailed
            ? `We emailed the full breakdown to ${b.customerEmail}.`
            : LIVE_DATA
              ? "Email delivery isn't configured yet, but your quote is saved under the reference below."
              : "Demo Mode: the quote email is printed in the server console instead of being sent."}
      </p>
      <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-brand/40 bg-brand/[0.06] p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Booking reference</p>
        <p className="mt-2 font-mono text-3xl tracking-wider text-brand">{b.bookingRef}</p>
        <p className="mt-3 text-sm text-ivory-dim">{formatDateLong(b.scheduledPickupAt)}</p>
        <p className="mt-1 text-lg text-ivory">{formatUSD(b.finalFare ?? b.estimatedFare)}</p>
      </div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href={trackHref}>Manage booking</ButtonLink>
        {done.kind === "quote" ? (
          <ButtonLink href={trackHref} variant="outline">
            Pay & confirm later
          </ButtonLink>
        ) : (
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">
        Need help? <Link href="/#faq" className="text-brand hover:underline">Read the FAQ</Link> or call dispatch any time.
      </p>
    </motion.div>
  );
}
