"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Clock, MapPin, PlaneLanding, PlaneTakeoff, Route } from "lucide-react";
import { AIRPORTS, CITY_ZONES, VEHICLE_CATEGORIES, VEHICLE_CLASSES, type VehicleSlug } from "@/lib/config";
import { fetchQuote } from "@/lib/client/api";
import { formatUSD, type ServiceType } from "@/lib/pricing";
import type { QuoteResult } from "@/lib/types";
import { OTHER_ZONE } from "@/lib/validation";
import { Alert, Button, Field, cn } from "../ui";

const TABS: { id: ServiceType; label: string; icon: typeof PlaneTakeoff }[] = [
  { id: "to_airport", label: "To Airport", icon: PlaneTakeoff },
  { id: "from_airport", label: "From Airport", icon: PlaneLanding },
  { id: "hourly", label: "Hourly", icon: Clock },
  { id: "point_to_point", label: "Point to Point", icon: Route },
];

export function QuoteWidget() {
  const router = useRouter();
  const [service, setService] = useState<ServiceType>("to_airport");
  const [airport, setAirport] = useState<string>("DCA");
  const [zone, setZone] = useState<string>("dc_downtown");
  const [address, setAddress] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [hours, setHours] = useState(3);
  const [vehicle, setVehicle] = useState<VehicleSlug>("sedan");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAirport = service === "to_airport" || service === "from_airport";

  function reset() {
    setQuote(null);
    setError(null);
  }

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const q = await fetchQuote({
        serviceType: service,
        tripType: "one_way",
        vehicleSlug: vehicle,
        airportCode: isAirport ? airport : null,
        cityZone: isAirport ? zone : null,
        pickupAddress: service === "to_airport" ? address : service === "from_airport" ? "" : pickup,
        dropoffAddress: service === "from_airport" ? address : service === "point_to_point" ? dropoff : "",
        hours: service === "hourly" ? hours : null,
        passengers: 1,
        luggage: 0,
        meetAndGreet: false,
        childSeats: 0,
      });
      setQuote(q);
    } catch (err) {
      setQuote(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function continueToBooking() {
    const params = new URLSearchParams({ service, vehicle });
    if (isAirport) {
      params.set("airport", airport);
      params.set("zone", zone);
      if (address) params.set(service === "to_airport" ? "pickup" : "dropoff", address);
    }
    if (service === "hourly") {
      params.set("hours", String(hours));
      if (pickup) params.set("pickup", pickup);
    }
    if (service === "point_to_point") {
      if (pickup) params.set("pickup", pickup);
      if (dropoff) params.set("dropoff", dropoff);
    }
    router.push(`/book?${params.toString()}`);
  }

  return (
    <div className="card-lux p-5 shadow-[0_30px_70px_-25px_rgba(11,31,58,0.45)] sm:p-6">
      <div className="mb-5 grid grid-cols-4 gap-1 rounded-full border border-line bg-ink-2 p-1" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={service === id}
            onClick={() => {
              setService(id);
              reset();
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-full px-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors sm:flex-row sm:justify-center sm:text-[11px]",
              service === id ? "bg-brand text-ink" : "text-ivory-dim hover:text-ivory",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="leading-none">{label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={getQuote} className="space-y-4">
        {isAirport && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={service === "to_airport" ? "Drop-off at" : "Pickup at"} htmlFor="qw-airport">
              <select
                id="qw-airport"
                className="input-lux"
                value={airport}
                onChange={(e) => {
                  setAirport(e.target.value);
                  reset();
                }}
              >
                {AIRPORTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.shortName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={service === "to_airport" ? "From area" : "To area"} htmlFor="qw-zone">
              <select
                id="qw-zone"
                className="input-lux"
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                  reset();
                }}
              >
                {CITY_ZONES.map((z) => (
                  <option key={z.slug} value={z.slug}>
                    {z.name}
                  </option>
                ))}
                <option value={OTHER_ZONE}>Other address (priced by distance)</option>
              </select>
            </Field>
            {zone === OTHER_ZONE && (
              <Field label="Address" className="sm:col-span-2" htmlFor="qw-address">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
                  <input
                    id="qw-address"
                    className="input-lux pl-10"
                    placeholder="Street, city, state"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      reset();
                    }}
                    required
                  />
                </div>
              </Field>
            )}
          </div>
        )}

        {service === "hourly" && (
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Pickup address" htmlFor="qw-hpickup">
              <input
                id="qw-hpickup"
                className="input-lux"
                placeholder="Hotel, office or home"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              />
            </Field>
            <Field label="Hours" htmlFor="qw-hours">
              <select
                id="qw-hours"
                className="input-lux"
                value={hours}
                onChange={(e) => {
                  setHours(Number(e.target.value));
                  reset();
                }}
              >
                {Array.from({ length: 22 }, (_, i) => i + 3).map((h) => (
                  <option key={h} value={h}>
                    {h} hrs
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {service === "point_to_point" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pickup address" htmlFor="qw-p2p-from">
              <input
                id="qw-p2p-from"
                className="input-lux"
                placeholder="From"
                value={pickup}
                onChange={(e) => {
                  setPickup(e.target.value);
                  reset();
                }}
                required
              />
            </Field>
            <Field label="Drop-off address" htmlFor="qw-p2p-to">
              <input
                id="qw-p2p-to"
                className="input-lux"
                placeholder="To"
                value={dropoff}
                onChange={(e) => {
                  setDropoff(e.target.value);
                  reset();
                }}
                required
              />
            </Field>
          </div>
        )}

        <Field label="Vehicle" htmlFor="qw-vehicle">
          <select
            id="qw-vehicle"
            className="input-lux"
            value={vehicle}
            onChange={(e) => {
              setVehicle(e.target.value as VehicleSlug);
              reset();
            }}
          >
            {VEHICLE_CATEGORIES.map((c) => (
              <optgroup key={c.id} label={c.label}>
                {VEHICLE_CLASSES.filter((v) => v.category === c.id).map((v) => (
                  <option key={v.slug} value={v.slug}>
                    {v.name} · up to {v.maxPassengers} passengers
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        {error && <Alert tone="error">{error}</Alert>}

        {quote ? (
          <div className="flex flex-col gap-4 rounded-xl border border-brand/40 bg-brand/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-ivory-dim">
                {quote.breakdown.pricingMethod === "flat_rate"
                  ? "All-inclusive flat rate"
                  : quote.breakdown.pricingMethod === "hourly"
                    ? `${quote.billableHours} hour minimum applies`
                    : `${quote.distanceMiles} miles`}
              </p>
              <p className="font-serif text-4xl text-brand">{formatUSD(quote.breakdown.totalFare)}</p>
              <p className="text-xs text-muted">One way · no surge pricing, ever</p>
            </div>
            <Button type="button" size="lg" onClick={continueToBooking}>
              Book this ride <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Get instant quote
          </Button>
        )}
      </form>
    </div>
  );
}
