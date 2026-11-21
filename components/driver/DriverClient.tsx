"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Clock, LogOut, MapPin, Navigation, Phone, Plane, RefreshCw, Users } from "lucide-react";
import { BOOKING_STATUS_LABELS, SERVICE_TYPE_LABELS, getAirport, getVehicleSeed } from "@/lib/config";
import { LIVE_DATA, driverUpdateRide, fetchDriverRides, getSession, logout, type SessionInfo } from "@/lib/client/api";
import { subscribeDemoDB } from "@/lib/client/demo-store";
import { formatDateTime, formatTime, isoToZonedLocal } from "@/lib/format";
import type { BookingStatus, BookingView, Driver } from "@/lib/types";
import { PasscodeLogin } from "../auth/PasscodeLogin";
import { Alert, Button, Spinner, StatusBadge, cn } from "../ui";

const NEXT_STEP: Partial<Record<BookingStatus, { status: BookingStatus; label: string }>> = {
  confirmed: { status: "en_route", label: "Start: En Route" },
  pending: { status: "en_route", label: "Start: En Route" },
  assigned: { status: "en_route", label: "Start: En Route" },
  en_route: { status: "arrived", label: "I've Arrived" },
  arrived: { status: "in_progress", label: "Passenger On Board" },
  in_progress: { status: "completed", label: "Complete Ride" },
};

export function DriverClient() {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    getSession()
      .then((s) => setSession(s?.role === "driver" && s.driverId ? s : null))
      .catch(() => setSession(null));
  }, []);

  if (session === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }
  if (!session || !session.driverId) return <PasscodeLogin role="driver" onSignedIn={setSession} />;
  return <DutyBoard driverId={session.driverId} onSignOut={() => logout().finally(() => setSession(null))} />;
}

function navTarget(ride: BookingView): string {
  const pickupDone = ride.status === "in_progress";
  const airport = getAirport(ride.airportCode);
  if (!pickupDone) {
    if (ride.serviceType === "from_airport" && airport) return airport.address;
    return ride.pickupAddress;
  }
  if (ride.serviceType === "to_airport" && airport) return airport.address;
  return ride.dropoffAddress || ride.pickupAddress;
}

function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

function DutyBoard({ driverId, onSignOut }: { driverId: string; onSignOut: () => void }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [rides, setRides] = useState<BookingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchDriverRides(driverId);
      setDriver(res.driver);
      setRides(res.rides);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
    if (!LIVE_DATA) return subscribeDemoDB(load);
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const { active, done } = useMemo(() => {
    const list = rides ?? [];
    return {
      active: list.filter((r) => r.status !== "completed"),
      done: list.filter((r) => r.status === "completed"),
    };
  }, [rides]);

  const grouped = useMemo(() => {
    const groups = new Map<string, BookingView[]>();
    for (const r of active) {
      const day = isoToZonedLocal(r.adjustedPickupAt ?? r.scheduledPickupAt).slice(0, 10);
      groups.set(day, [...(groups.get(day) ?? []), r]);
    }
    return [...groups.entries()];
  }, [active]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">On duty</p>
          <h1 className="heading-lux mt-1 text-3xl">{driver?.fullName ?? "Driver"}</h1>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={load} loading={refreshing} aria-label="Refresh rides">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" /> Off duty
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {!rides ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : active.length === 0 ? (
        <div className="card-lux p-10 text-center text-ivory-dim">
          No upcoming rides assigned. Dispatch will assign your next ride{!LIVE_DATA ? " (try assigning one in /admin)" : ""}.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-3 text-xs uppercase tracking-[0.25em] text-muted">
                {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
                  new Date(`${day}T12:00:00Z`),
                )}
              </h2>
              <div className="space-y-4">
                {list.map((r) => (
                  <RideCard key={r.id} ride={r} onUpdated={load} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-10">
          <button type="button" className="text-sm text-ivory-dim hover:text-gold" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} completed rides ({done.length})
          </button>
          {showDone && (
            <ul className="mt-3 space-y-2">
              {done.map((r) => (
                <li key={r.id} className="flex justify-between rounded-xl border border-line px-4 py-3 text-sm text-ivory-dim">
                  <span>
                    <span className="font-mono text-gold">{r.bookingRef}</span> · {r.customerName}
                  </span>
                  <span>{formatDateTime(r.scheduledPickupAt, { withZone: false })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RideCard({ ride, onUpdated }: { ride: BookingView; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STEP[ride.status];
  const pickupIso = ride.adjustedPickupAt ?? ride.scheduledPickupAt;
  const airport = getAirport(ride.airportCode);
  const target = navTarget(ride);

  async function advance() {
    if (!next) return;
    setUpdating(true);
    setError(null);
    try {
      await driverUpdateRide(ride, next.status);
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <article className={cn("card-lux overflow-hidden", ride.status === "en_route" || ride.status === "arrived" || ride.status === "in_progress" ? "border-gold/60" : "")}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="flex items-center gap-2 font-serif text-3xl text-ivory">
            <Clock className="h-5 w-5 text-gold" /> {formatTime(pickupIso)}
          </p>
          {ride.adjustedPickupAt && (
            <p className="text-xs text-warning">
              Moved from {formatTime(ride.scheduledPickupAt)} · flight {ride.flightStatus}
            </p>
          )}
          {ride.flightStatus === "cancelled" && <p className="text-xs text-danger">Flight cancelled: call dispatch before driving</p>}
          <p className="mt-1 text-xs uppercase tracking-wider text-muted">
            {SERVICE_TYPE_LABELS[ride.serviceType]} · {getVehicleSeed(ride.vehicleSlug)?.name}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="space-y-3 px-5 py-4 text-sm">
        <p className="flex gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            <span className="block text-[11px] uppercase tracking-wider text-muted">Pickup</span>
            <span className="text-ivory">{ride.pickupAddress}</span>
          </span>
        </p>
        {ride.dropoffAddress && (
          <p className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-muted">Drop-off</span>
              <span className="text-ivory">{ride.dropoffAddress}</span>
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-ivory-dim">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-gold" /> {ride.passengers}
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-gold" /> {ride.luggage}
          </span>
          {ride.flightNumber && (
            <span className="flex items-center gap-1.5">
              <Plane className="h-4 w-4 text-gold" /> {ride.flightNumber}
              {airport ? ` · ${airport.code === "UNION_DC" ? "Union Stn" : airport.code}` : ""}
            </span>
          )}
          {ride.hoursBooked && <span>{ride.hoursBooked} hrs</span>}
          {ride.meetAndGreet && <span className="text-gold">Meet & Greet: name sign at baggage claim</span>}
          {ride.childSeats > 0 && <span className="text-gold">{ride.childSeats} child seat(s)</span>}
        </div>
        {ride.notes && <p className="rounded-lg bg-white/5 px-3 py-2 text-ivory-dim">“{ride.notes}”</p>}
        <p className="text-ivory-dim">
          <span className="text-ivory">{ride.customerName}</span> · <span className="font-mono text-xs text-gold">{ride.bookingRef}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        <a
          href={mapsLink(target)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-gold/50 py-3 text-sm font-semibold text-gold hover:bg-gold/10"
        >
          <Navigation className="h-4 w-4" /> Navigate
        </a>
        <a
          href={`tel:${ride.customerPhone.replace(/[^+\d]/g, "")}`}
          className="flex items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold text-ivory-dim hover:border-gold/50"
        >
          <Phone className="h-4 w-4" /> Call guest
        </a>
        {next && (
          <Button size="lg" className="col-span-2" onClick={advance} loading={updating}>
            {next.label}
          </Button>
        )}
        {error && (
          <div className="col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </div>
      <p className="sr-only">Current status: {BOOKING_STATUS_LABELS[ride.status]}</p>
    </article>
  );
}
