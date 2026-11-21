"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  DollarSign,
  Download,
  LogOut,
  Plane,
  Plus,
  RefreshCw,
  Search,
  UserX,
} from "lucide-react";
import {
  AIRPORTS,
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  CITY_ZONES,
  SERVICE_TYPE_LABELS,
  getAirport,
  getVehicleSeed,
} from "@/lib/config";
import {
  LIVE_DATA,
  adminAddDriver,
  adminSaveFlatRate,
  adminUpdateBooking,
  fetchAdminData,
  getSession,
  logout,
  type AdminBookingPatch,
  type AdminData,
  type SessionInfo,
} from "@/lib/client/api";
import { subscribeDemoDB } from "@/lib/client/demo-store";
import { bookingsToCsv, downloadCsv } from "@/lib/csv";
import { formatDateTime, isoToZonedLocal } from "@/lib/format";
import { formatUSD, type ServiceType } from "@/lib/pricing";
import type { BookingStatus, BookingView } from "@/lib/types";
import { PasscodeLogin } from "../auth/PasscodeLogin";
import { Alert, Button, Field, PaymentBadge, Spinner, StatusBadge, cn } from "../ui";

type Tab = "bookings" | "drivers" | "rates";
type Range = "upcoming" | "today" | "past" | "all";

export function AdminClient() {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    getSession()
      .then((s) => setSession(s?.role === "admin" ? s : null))
      .catch(() => setSession(null));
  }, []);

  if (session === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }
  if (!session) return <PasscodeLogin role="admin" onSignedIn={setSession} />;
  return <Dashboard onSignOut={() => logout().finally(() => setSession(null))} />;
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("bookings");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await fetchAdminData());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!LIVE_DATA) return subscribeDemoDB(load);
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="container-lux py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Dispatch</p>
          <h1 className="heading-lux mt-2 text-4xl">Operations dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} loading={refreshing}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-full border border-line bg-ink-2 p-1 sm:w-fit" role="tablist">
        {(
          [
            ["bookings", "Bookings"],
            ["drivers", "Drivers & Fleet"],
            ["rates", "Flat Rates"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm transition-colors sm:flex-none",
              tab === id ? "bg-gold text-ink" : "text-ivory-dim hover:text-ivory",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {!data ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : tab === "bookings" ? (
        <BookingsPanel data={data} onChanged={load} />
      ) : tab === "drivers" ? (
        <DriversPanel data={data} onChanged={load} />
      ) : (
        <RatesPanel data={data} onChanged={load} />
      )}
    </div>
  );
}

/* --------------------------------- Bookings -------------------------------- */

function sameServiceDay(iso: string, ref: Date): boolean {
  return isoToZonedLocal(iso).slice(0, 10) === isoToZonedLocal(ref.toISOString()).slice(0, 10);
}

function BookingsPanel({ data, onChanged }: { data: AdminData; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all" | "active">("active");
  const [service, setService] = useState<ServiceType | "all">("all");
  const [range, setRange] = useState<Range>("upcoming");
  const [expanded, setExpanded] = useState<string | null>(null);

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.bookings
      .filter((b) => {
        const pickup = Date.parse(b.adjustedPickupAt ?? b.scheduledPickupAt);
        if (range === "upcoming" && pickup < now.getTime() - 3 * 3_600_000) return false;
        if (range === "past" && pickup >= now.getTime()) return false;
        if (range === "today" && !sameServiceDay(b.adjustedPickupAt ?? b.scheduledPickupAt, now)) return false;
        if (status === "active" && (b.status === "cancelled" || b.status === "completed")) return false;
        if (status !== "all" && status !== "active" && b.status !== status) return false;
        if (service !== "all" && b.serviceType !== service) return false;
        if (!q) return true;
        return [b.bookingRef, b.customerName, b.customerEmail, b.customerPhone, b.pickupAddress, b.dropoffAddress, b.flightNumber, b.driver?.fullName]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q));
      })
      .sort((a, b) =>
        range === "past"
          ? Date.parse(b.scheduledPickupAt) - Date.parse(a.scheduledPickupAt)
          : Date.parse(a.adjustedPickupAt ?? a.scheduledPickupAt) - Date.parse(b.adjustedPickupAt ?? b.scheduledPickupAt),
      );
  }, [data.bookings, query, status, service, range, now]);

  const stats = useMemo(() => {
    const active = data.bookings.filter((b) => b.status !== "cancelled");
    return {
      today: active.filter((b) => sameServiceDay(b.adjustedPickupAt ?? b.scheduledPickupAt, now)).length,
      unassigned: active.filter(
        (b) => !b.driverId && b.status !== "completed" && b.paymentStatus === "paid" && Date.parse(b.scheduledPickupAt) > now.getTime(),
      ).length,
      delayed: active.filter((b) => b.flightStatus === "delayed" || b.flightStatus === "cancelled").length,
      revenue: data.bookings.filter((b) => b.paymentStatus === "paid").reduce((s, b) => s + (b.finalFare ?? b.estimatedFare), 0),
    };
  }, [data.bookings, now]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CalendarClock} label="Rides today" value={String(stats.today)} />
        <Stat icon={UserX} label="Paid & unassigned" value={String(stats.unassigned)} tone={stats.unassigned > 0 ? "warning" : undefined} />
        <Stat icon={Plane} label="Flight alerts" value={String(stats.delayed)} tone={stats.delayed > 0 ? "warning" : undefined} />
        <Stat icon={DollarSign} label="Paid revenue" value={formatUSD(stats.revenue)} />
      </div>

      <div className="card-lux flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
          <input
            className="input-lux pl-10"
            placeholder="Search ref, name, phone, flight, driver…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search bookings"
          />
        </div>
        <select className="input-lux lg:w-36" value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Date range">
          <option value="upcoming">Upcoming</option>
          <option value="today">Today</option>
          <option value="past">Past</option>
          <option value="all">All dates</option>
        </select>
        <select className="input-lux lg:w-44" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="active">Active</option>
          <option value="all">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input-lux lg:w-48" value={service} onChange={(e) => setService(e.target.value as typeof service)} aria-label="Service">
          <option value="all">All services</option>
          {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((s) => (
            <option key={s} value={s}>
              {SERVICE_TYPE_LABELS[s]}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => downloadCsv(`bookings-${new Date().toISOString().slice(0, 10)}.csv`, bookingsToCsv(filtered))}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="card-lux overflow-hidden">
        <div className="hidden grid-cols-[110px_1.2fr_1.6fr_1fr_1fr_110px_24px] gap-3 border-b border-line px-5 py-3 text-[11px] uppercase tracking-wider text-muted lg:grid">
          <span>Pickup</span>
          <span>Customer</span>
          <span>Route</span>
          <span>Vehicle / driver</span>
          <span>Status</span>
          <span className="text-right">Fare</span>
          <span />
        </div>
        {filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-ivory-dim">No bookings match these filters.</p>
        ) : (
          filtered.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              data={data}
              open={expanded === b.id}
              onToggle={() => setExpanded((id) => (id === b.id ? null : b.id))}
              onChanged={onChanged}
            />
          ))
        )}
      </div>
      <p className="text-xs text-muted">
        {filtered.length} of {data.bookings.length} bookings · times shown in Eastern Time
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Plane; label: string; value: string; tone?: "warning" }) {
  return (
    <div className="card-lux p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <Icon className={cn("h-4 w-4", tone === "warning" ? "text-warning" : "text-gold")} /> {label}
      </div>
      <p className={cn("mt-2 font-serif text-3xl", tone === "warning" ? "text-warning" : "text-ivory")}>{value}</p>
    </div>
  );
}

function routeText(b: BookingView): string {
  const airport = getAirport(b.airportCode);
  if (b.serviceType === "to_airport") return `${b.pickupAddress} → ${airport?.code === "UNION_DC" ? "Union Stn" : airport?.code}`;
  if (b.serviceType === "from_airport") return `${airport?.code === "UNION_DC" ? "Union Stn" : airport?.code} → ${b.dropoffAddress ?? ""}`;
  if (b.serviceType === "hourly") return `${b.hoursBooked}h from ${b.pickupAddress}`;
  return `${b.pickupAddress} → ${b.dropoffAddress ?? ""}`;
}

function BookingRow({
  booking: b,
  data,
  open,
  onToggle,
  onChanged,
}: {
  booking: BookingView;
  data: AdminData;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [driverId, setDriverId] = useState(b.driverId ?? "");
  const [vehicleId, setVehicleId] = useState(b.vehicleId ?? "");
  const [status, setStatus] = useState<BookingStatus>(b.status);
  const [finalFare, setFinalFare] = useState(b.finalFare != null ? String(b.finalFare) : "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setDriverId(b.driverId ?? "");
    setVehicleId(b.vehicleId ?? "");
    setStatus(b.status);
    setFinalFare(b.finalFare != null ? String(b.finalFare) : "");
  }, [b.driverId, b.vehicleId, b.status, b.finalFare]);

  const pickupIso = b.adjustedPickupAt ?? b.scheduledPickupAt;
  const vehicleSeed = getVehicleSeed(b.vehicleSlug);

  async function save() {
    setSaving(true);
    setMsg(null);
    const patch: AdminBookingPatch = {};
    if ((driverId || null) !== b.driverId) patch.driverId = driverId || null;
    if ((vehicleId || null) !== b.vehicleId) patch.vehicleId = vehicleId || null;
    if (status !== b.status) patch.status = status;
    const fare = finalFare.trim() === "" ? null : Number(finalFare);
    if (fare !== null && (Number.isNaN(fare) || fare < 0)) {
      setMsg({ tone: "error", text: "Enter a valid fare" });
      setSaving(false);
      return;
    }
    if (fare !== b.finalFare) patch.finalFare = fare;
    if (Object.keys(patch).length === 0) {
      setMsg({ tone: "success", text: "No changes" });
      setSaving(false);
      return;
    }
    try {
      await adminUpdateBooking(b.id, patch);
      setMsg({ tone: "success", text: "Saved" });
      onChanged();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("border-b border-line/70 last:border-0", open && "bg-white/[0.02]")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-1 gap-2 px-5 py-4 text-left text-sm hover:bg-white/[0.02] lg:grid-cols-[110px_1.2fr_1.6fr_1fr_1fr_110px_24px] lg:items-center lg:gap-3"
      >
        <span>
          <span className="block text-ivory">{formatDateTime(pickupIso, { withZone: false })}</span>
          {b.adjustedPickupAt && <span className="text-[11px] text-warning">Adjusted · flight {b.flightStatus}</span>}
          {!b.adjustedPickupAt && b.flightStatus === "cancelled" && <span className="text-[11px] text-danger">Flight cancelled</span>}
        </span>
        <span>
          <span className="block text-ivory">{b.customerName}</span>
          <span className="font-mono text-[11px] text-gold">{b.bookingRef}</span>
        </span>
        <span className="text-ivory-dim">
          <span className="block text-[11px] uppercase tracking-wider text-muted">
            {SERVICE_TYPE_LABELS[b.serviceType]}
            {b.tripType === "round_trip" ? " · RT" : ""}
            {b.flightNumber ? ` · ${b.flightNumber}` : ""}
          </span>
          <span className="line-clamp-2">{routeText(b)}</span>
        </span>
        <span className="text-ivory-dim">
          <span className="block">{vehicleSeed?.name}</span>
          <span className={cn("text-[11px]", b.driver ? "text-ivory" : "text-warning")}>{b.driver?.fullName ?? "Unassigned"}</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          <StatusBadge status={b.status} />
          <PaymentBadge status={b.paymentStatus} />
        </span>
        <span className="text-ivory tabular-nums lg:text-right">{formatUSD(b.finalFare ?? b.estimatedFare)}</span>
        <ChevronDown className={cn("hidden h-4 w-4 text-muted transition-transform lg:block", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid gap-6 border-t border-line/60 px-5 py-5 lg:grid-cols-[1.2fr_1fr]">
          <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Contact</dt>
            <dd className="text-ivory">
              <a href={`mailto:${b.customerEmail}`} className="hover:text-gold">
                {b.customerEmail}
              </a>{" "}
              ·{" "}
              <a href={`tel:${b.customerPhone.replace(/[^+\d]/g, "")}`} className="hover:text-gold">
                {b.customerPhone}
              </a>
            </dd>
            <dt className="text-muted">Pickup</dt>
            <dd className="text-ivory">{b.pickupAddress}</dd>
            {b.dropoffAddress && (
              <>
                <dt className="text-muted">Drop-off</dt>
                <dd className="text-ivory">{b.dropoffAddress}</dd>
              </>
            )}
            <dt className="text-muted">Scheduled</dt>
            <dd className="text-ivory">{formatDateTime(b.scheduledPickupAt)}</dd>
            {b.returnPickupAt && (
              <>
                <dt className="text-muted">Return</dt>
                <dd className="text-ivory">
                  {formatDateTime(b.returnPickupAt)} {b.returnFlightNumber ? `· ${b.returnFlightNumber}` : ""}
                </dd>
              </>
            )}
            <dt className="text-muted">Party</dt>
            <dd className="text-ivory">
              {b.passengers} pax · {b.luggage} bags{b.childSeats ? ` · ${b.childSeats} child seat(s)` : ""}
              {b.meetAndGreet ? " · Meet & Greet" : ""}
            </dd>
            <dt className="text-muted">Pricing</dt>
            <dd className="text-ivory">
              {b.pricingMethod === "flat_rate" ? "Flat rate" : b.pricingMethod === "hourly" ? "Hourly" : `Distance (${b.distanceMiles ?? "?"} mi)`} ·
              quoted {formatUSD(b.estimatedFare)}
            </dd>
            {b.notes && (
              <>
                <dt className="text-muted">Notes</dt>
                <dd className="whitespace-pre-wrap text-ivory">{b.notes}</dd>
              </>
            )}
            {b.refundAmount != null && b.refundAmount > 0 && (
              <>
                <dt className="text-muted">Refunded</dt>
                <dd className="text-ivory">{formatUSD(b.refundAmount)}</dd>
              </>
            )}
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Driver" htmlFor={`drv-${b.id}`}>
              <select
                id={`drv-${b.id}`}
                className="input-lux"
                value={driverId}
                onChange={(e) => {
                  setDriverId(e.target.value);
                  const own = data.vehicles.find((v) => v.driverId === e.target.value && v.vehicleSlug === b.vehicleSlug);
                  if (own && !vehicleId) setVehicleId(own.id);
                }}
              >
                <option value="">Unassigned</option>
                {data.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle" htmlFor={`veh-${b.id}`}>
              <select id={`veh-${b.id}`} className="input-lux" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Not set</option>
                {data.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} · {v.makeModel}
                    {v.vehicleSlug !== b.vehicleSlug ? " (other class)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" htmlFor={`st-${b.id}`}>
              <select id={`st-${b.id}`} className="input-lux" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {BOOKING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Final fare override ($)"
              htmlFor={`ff-${b.id}`}
              hint={b.paymentStatus === "paid" ? "Locked after payment" : "Blank = use quoted fare"}
            >
              <input
                id={`ff-${b.id}`}
                className="input-lux"
                inputMode="decimal"
                value={finalFare}
                disabled={b.paymentStatus === "paid"}
                onChange={(e) => setFinalFare(e.target.value)}
                placeholder={b.estimatedFare.toFixed(2)}
              />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button onClick={save} loading={saving}>
                Save changes
              </Button>
              {msg && <span className={cn("text-sm", msg.tone === "success" ? "text-success" : "text-danger")}>{msg.text}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Drivers & fleet ----------------------------- */

function DriversPanel({ data, onChanged }: { data: AdminData; onChanged: () => void }) {
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", licenseNumber: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ridesByDriver = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of data.bookings) {
      if (b.driverId && b.status !== "cancelled" && b.status !== "completed") map.set(b.driverId, (map.get(b.driverId) ?? 0) + 1);
    }
    return map;
  }, [data.bookings]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminAddDriver(form);
      setForm({ fullName: "", phone: "", email: "", licenseNumber: "" });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <div className="card-lux overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Chauffeur</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">License</th>
                <th className="px-5 py-3 text-right font-medium">Open rides</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((d) => (
                <tr key={d.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3">
                    <span className="block text-ivory">{d.fullName}</span>
                    <span className="text-xs text-muted">{d.email}</span>
                  </td>
                  <td className="px-5 py-3 text-ivory-dim">{d.phone}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ivory-dim">{d.licenseNumber ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-ivory">{ridesByDriver.get(d.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-lux overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-medium">Plate</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">Default driver</th>
              </tr>
            </thead>
            <tbody>
              {data.vehicles.map((v) => (
                <tr key={v.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 font-mono text-gold">{v.plateNumber}</td>
                  <td className="px-5 py-3 text-ivory">
                    {v.year} {v.makeModel}
                  </td>
                  <td className="px-5 py-3 text-ivory-dim">{getVehicleSeed(v.vehicleSlug)?.name}</td>
                  <td className="px-5 py-3 text-ivory-dim">{data.drivers.find((d) => d.id === v.driverId)?.fullName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={add} className="card-lux h-fit space-y-4 p-6">
        <p className="eyebrow">Add chauffeur</p>
        <Field label="Full name" htmlFor="nd-name">
          <input id="nd-name" className="input-lux" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </Field>
        <Field label="Phone" htmlFor="nd-phone">
          <input id="nd-phone" className="input-lux" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </Field>
        <Field label="Email (for flight alerts)" htmlFor="nd-email">
          <input id="nd-email" type="email" className="input-lux" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="License number" htmlFor="nd-lic">
          <input id="nd-lic" className="input-lux" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" className="w-full" loading={saving}>
          <Plus className="h-4 w-4" /> Add chauffeur
        </Button>
      </form>
    </div>
  );
}

/* -------------------------------- Flat rates -------------------------------- */

function RatesPanel({ data, onChanged }: { data: AdminData; onChanged: () => void }) {
  const [airport, setAirport] = useState<string>("DCA");
  const [vehicleSlug, setVehicleSlug] = useState<string>("sedan");
  const vehicleClass = data.vehicleClasses.find((v) => v.slug === vehicleSlug);

  const current = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data.flatRates) if (r.airportCode === airport && r.vehicleSlug === vehicleSlug) map.set(r.cityZone, r.oneWayFare);
    return map;
  }, [data.flatRates, airport, vehicleSlug]);

  return (
    <div className="space-y-4">
      <div className="card-lux flex flex-col gap-3 p-4 sm:flex-row">
        <Field label="Airport / station" htmlFor="fr-airport" className="flex-1">
          <select id="fr-airport" className="input-lux" value={airport} onChange={(e) => setAirport(e.target.value)}>
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.shortName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vehicle class" htmlFor="fr-vehicle" className="flex-1">
          <select id="fr-vehicle" className="input-lux" value={vehicleSlug} onChange={(e) => setVehicleSlug(e.target.value)}>
            {data.vehicleClasses.map((v) => (
              <option key={v.slug} value={v.slug}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!LIVE_DATA && (
        <Alert tone="info">
          Demo Mode: rate edits are saved in this browser and used by the server for demo quotes only. With Supabase connected they are saved to
          the <code>flat_rates</code> table.
        </Alert>
      )}
      <div className="card-lux divide-y divide-line/60">
        {CITY_ZONES.map((z) => (
          <RateRow
            key={`${airport}-${vehicleSlug}-${z.slug}`}
            zoneName={z.name}
            value={current.get(z.slug) ?? null}
            onSave={async (fare) => {
              if (!vehicleClass) throw new Error("Unknown vehicle class");
              await adminSaveFlatRate({ airportCode: airport, cityZone: z.slug, vehicleClassId: vehicleClass.id, vehicleSlug, oneWayFare: fare });
              onChanged();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RateRow({ zoneName, value, onSave }: { zoneName: string; value: number | null; onSave: (fare: number) => Promise<void> }) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = draft !== (value != null ? String(value) : "");

  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);

  async function save() {
    const fare = Number(draft);
    if (!draft || Number.isNaN(fare) || fare <= 0) {
      setState("error");
      setError("Enter a positive amount");
      return;
    }
    setState("saving");
    try {
      await onSave(Math.round(fare * 100) / 100);
      setState("saved");
      setError(null);
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-[220px] flex-1 text-sm text-ivory">{zoneName}</span>
      <div className="relative w-32">
        <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted">$</span>
        <input
          className="input-lux py-2.5 pl-7 text-right"
          inputMode="decimal"
          value={draft}
          placeholder="—"
          onChange={(e) => {
            setDraft(e.target.value);
            setState("idle");
          }}
          aria-label={`${zoneName} fare`}
        />
      </div>
      <Button size="sm" variant={dirty ? "gold" : "ghost"} onClick={save} loading={state === "saving"} disabled={!dirty}>
        Save
      </Button>
      <span className="w-24 text-xs">
        {state === "saved" && <span className="text-success">Saved</span>}
        {state === "error" && <span className="text-danger">{error}</span>}
      </span>
    </div>
  );
}
