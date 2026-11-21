"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Car, Check, MessageSquare, Phone, Plane, RefreshCw, Search, XCircle } from "lucide-react";
import { BRAND, SERVICE_TYPE_LABELS, getAirport, getVehicleSeed } from "@/lib/config";
import {
  ApiError,
  LIVE_DATA,
  applyDemoFlightUpdate,
  cancelBooking,
  confirmPayment,
  fetchFlightStatus,
  lookupBooking,
  startPayment,
  type LookupResult,
  type PaymentStart,
} from "@/lib/client/api";
import { bookingToInput } from "@/lib/client/booking-input";
import { subscribeDemoDB } from "@/lib/client/demo-store";
import { formatDateLong, formatTime } from "@/lib/format";
import { formatUSD } from "@/lib/pricing";
import type { BookingStatus, FlightStatusResult } from "@/lib/types";
import { StripePayment } from "../book/StripePayment";
import { Alert, Button, Field, PaymentBadge, Spinner, StatusBadge, cn } from "../ui";

const TIMELINE: { status: BookingStatus; label: string }[] = [
  { status: "confirmed", label: "Confirmed" },
  { status: "assigned", label: "Chauffeur assigned" },
  { status: "en_route", label: "En route" },
  { status: "arrived", label: "Arrived" },
  { status: "in_progress", label: "On board" },
  { status: "completed", label: "Completed" },
];
const ORDER: BookingStatus[] = ["pending", "confirmed", "assigned", "en_route", "arrived", "in_progress", "completed"];

function telHref(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

export function TrackClient() {
  const params = useSearchParams();
  const [ref, setRef] = useState(params.get("ref") ?? "");
  const [contact, setContact] = useState(params.get("contact") ?? "");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flight, setFlight] = useState<FlightStatusResult | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentStart | null>(null);
  const [paying, setPaying] = useState(false);
  const lastQuery = useRef<{ ref: string; contact: string } | null>(null);

  const lookup = useCallback(async (r: string, c: string, quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await lookupBooking(r.trim(), c.trim());
      setResult(res);
      lastQuery.current = { ref: r.trim(), contact: c.trim() };
    } catch (err) {
      if (!quiet) {
        setResult(null);
        setError((err as ApiError).message);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Auto-lookup from the confirmation link.
  useEffect(() => {
    const r = params.get("ref");
    const c = params.get("contact");
    if (r && c) lookup(r, c);
  }, [params, lookup]);

  // Keep status fresh: poll in live mode, listen to LocalStorage in demo mode.
  useEffect(() => {
    if (!result) return;
    const refresh = () => lastQuery.current && lookup(lastQuery.current.ref, lastQuery.current.contact, true);
    if (!LIVE_DATA) return subscribeDemoDB(refresh);
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [result, lookup]);

  const booking = result?.booking;

  const checkFlight = useCallback(async () => {
    if (!booking?.flightNumber) return;
    setFlightLoading(true);
    try {
      const { flight: f, adjustment } = await fetchFlightStatus(booking.flightNumber, booking.scheduledPickupAt);
      setFlight(f);
      if (!LIVE_DATA && adjustment?.shouldUpdate) {
        applyDemoFlightUpdate(booking.id, adjustment.flightStatus, adjustment.adjustedPickupAt);
      }
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setFlightLoading(false);
    }
  }, [booking?.flightNumber, booking?.scheduledPickupAt, booking?.id]);

  useEffect(() => {
    if (booking?.serviceType === "from_airport" && booking.flightNumber && !flight && booking.status !== "cancelled") {
      checkFlight();
    }
  }, [booking?.serviceType, booking?.flightNumber, booking?.status, flight, checkFlight]);

  async function doCancel() {
    if (!booking || !lastQuery.current) return;
    setCancelling(true);
    try {
      const res = await cancelBooking(booking.bookingRef, lastQuery.current.contact);
      setNotice(
        `${res.message}${res.refundAmount > 0 ? ` A refund of ${formatUSD(res.refundAmount)} has been issued to your card.` : ""}`,
      );
      setConfirmCancel(false);
      await lookup(lastQuery.current.ref, lastQuery.current.contact, true);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  async function beginPayment() {
    if (!booking) return;
    setPaying(true);
    setNotice(null);
    try {
      setPayment(await startPayment(booking.bookingRef, bookingToInput(booking)));
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  async function onPaid(paymentIntentId: string | null) {
    if (!booking || !lastQuery.current) return;
    const ok = await confirmPayment(booking.bookingRef, paymentIntentId);
    if (!ok) throw new Error("Payment not confirmed yet. Refresh in a minute.");
    setPayment(null);
    setNotice("Payment received. Your ride is confirmed.");
    await lookup(lastQuery.current.ref, lastQuery.current.contact, true);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form
        className="card-lux h-fit space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setFlight(null);
          setNotice(null);
          setPayment(null);
          setConfirmCancel(false);
          lookup(ref, contact);
        }}
      >
        <Field label="Booking reference" htmlFor="ref">
          <input
            id="ref"
            className="input-lux font-mono uppercase tracking-wider"
            placeholder="CE-XXXXXX"
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            required
          />
        </Field>
        <Field label="Email or phone used to book" htmlFor="contact">
          <input id="contact" className="input-lux" value={contact} onChange={(e) => setContact(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          <Search className="h-4 w-4" /> Find my booking
        </Button>
        {error && <Alert tone="error">{error}</Alert>}
        {!LIVE_DATA && (
          <p className="text-xs text-muted">
            Demo: try <span className="font-mono text-ivory-dim">CE-DEMO01</span> with <span className="text-ivory-dim">avery@example.com</span>.
          </p>
        )}
      </form>

      <div>
        {!booking && !loading && (
          <div className="card-lux grid place-items-center p-12 text-center text-ivory-dim">
            <Car className="h-10 w-10 text-gold" />
            <p className="mt-4 max-w-sm">Enter your booking reference to see live status, your chauffeur and flight updates.</p>
          </div>
        )}
        {loading && !booking && (
          <div className="card-lux grid place-items-center p-12">
            <Spinner />
          </div>
        )}

        {booking && result && (
          <div className="space-y-6">
            {notice && <Alert tone="info">{notice}</Alert>}

            <div className="card-lux p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted">{SERVICE_TYPE_LABELS[booking.serviceType]}</p>
                  <p className="mt-1 font-mono text-2xl text-gold">{booking.bookingRef}</p>
                  <p className="mt-1 text-sm text-ivory-dim">{booking.customerName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={booking.status} />
                  <PaymentBadge status={booking.paymentStatus} />
                  {booking.isQuote && booking.paymentStatus === "unpaid" && (
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ivory-dim">Quote</span>
                  )}
                </div>
              </div>

              {booking.status !== "cancelled" ? (
                <ol className="mt-8 grid grid-cols-3 gap-y-6 sm:grid-cols-6">
                  {TIMELINE.map((t) => {
                    const reached = ORDER.indexOf(booking.status) >= ORDER.indexOf(t.status);
                    const current = booking.status === t.status;
                    return (
                      <li key={t.status} className="relative flex flex-col items-center text-center">
                        <span
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-full border text-xs",
                            reached ? "border-gold bg-gold text-ink" : "border-line text-muted",
                            current && "ring-4 ring-gold/25",
                          )}
                        >
                          {reached ? <Check className="h-4 w-4" /> : null}
                        </span>
                        <span className={cn("mt-2 text-[11px]", reached ? "text-ivory" : "text-muted")}>{t.label}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-6">
                  <Alert tone="warning">
                    Cancelled{booking.cancelledAt ? ` on ${formatDateLong(booking.cancelledAt)}` : ""}.
                    {booking.refundAmount ? ` Refunded ${formatUSD(booking.refundAmount)}.` : ""}
                  </Alert>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="card-lux p-6">
                <p className="eyebrow">Trip</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <Row k="Pickup time" v={formatDateLong(booking.adjustedPickupAt ?? booking.scheduledPickupAt)} />
                  {booking.adjustedPickupAt && <Row k="Originally" v={formatDateLong(booking.scheduledPickupAt)} muted />}
                  <Row k="Pickup" v={booking.pickupAddress} />
                  {booking.dropoffAddress && <Row k="Drop-off" v={booking.dropoffAddress} />}
                  {booking.hoursBooked && <Row k="Duration" v={`${booking.hoursBooked} hours`} />}
                  {booking.tripType === "round_trip" && <Row k="Return" v={formatDateLong(booking.returnPickupAt)} />}
                  {booking.returnFlightNumber && <Row k="Return flight" v={booking.returnFlightNumber} />}
                  <Row k="Vehicle" v={getVehicleSeed(booking.vehicleSlug)?.name ?? booking.vehicleSlug} />
                  <Row k="Passengers / bags" v={`${booking.passengers} / ${booking.luggage}`} />
                  {booking.meetAndGreet && <Row k="Meet & Greet" v="Included" />}
                  {booking.childSeats > 0 && <Row k="Child seats" v={String(booking.childSeats)} />}
                  <Row k="Fare" v={formatUSD(booking.finalFare ?? booking.estimatedFare)} />
                </dl>
              </div>

              <div className="space-y-6">
                <div className="card-lux p-6">
                  <p className="eyebrow">Your chauffeur</p>
                  {booking.driver ? (
                    <div className="mt-4">
                      <p className="font-serif text-2xl text-ivory">{booking.driver.fullName}</p>
                      {booking.vehicle && (
                        <p className="mt-1 text-sm text-ivory-dim">
                          {booking.vehicle.makeModel} · <span className="font-mono">{booking.vehicle.plateNumber}</span>
                        </p>
                      )}
                      {booking.status !== "completed" && booking.status !== "cancelled" && (
                        <div className="mt-4 flex gap-2">
                          <a href={`tel:${telHref(booking.driver.phone)}`} className="flex items-center gap-2 rounded-full border border-gold/50 px-4 py-2 text-sm text-gold hover:bg-gold/10">
                            <Phone className="h-4 w-4" /> Call
                          </a>
                          <a href={`sms:${telHref(booking.driver.phone)}`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-ivory-dim hover:border-gold/50">
                            <MessageSquare className="h-4 w-4" /> Text
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-ivory-dim">
                      We assign your chauffeur ahead of pickup. Their name, phone and vehicle will appear here.
                    </p>
                  )}
                </div>

                {booking.serviceType === "from_airport" && booking.flightNumber && (
                  <div className="card-lux p-6">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow">Flight {booking.flightNumber}</p>
                      <button type="button" onClick={checkFlight} className="text-muted hover:text-gold" aria-label="Refresh flight status">
                        <RefreshCw className={cn("h-4 w-4", flightLoading && "animate-spin")} />
                      </button>
                    </div>
                    {flight ? (
                      <div className="mt-4 space-y-2 text-sm">
                        <p className="flex items-center gap-2">
                          <Plane className="h-4 w-4 text-gold" />
                          <span className="capitalize text-ivory">{flight.status.replace("-", " ")}</span>
                          {flight.delayMinutes != null && flight.delayMinutes !== 0 && flight.status !== "cancelled" && (
                            <span className={flight.delayMinutes > 0 ? "text-warning" : "text-success"}>
                              {flight.delayMinutes > 0 ? `+${flight.delayMinutes} min` : `${flight.delayMinutes} min early`}
                            </span>
                          )}
                        </p>
                        {flight.estimatedArrival && <Row k="Estimated arrival" v={formatTime(flight.estimatedArrival)} />}
                        {flight.status === "cancelled" && (
                          <Alert tone="warning">
                            Your airline cancelled this flight. You can cancel below for a 100% refund, or call us to rebook free.
                          </Alert>
                        )}
                        {flight.simulated && <p className="text-xs text-muted">Simulated flight data (AirLabs key not set).</p>}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-ivory-dim">{flightLoading ? "Checking…" : "Flight status unavailable."}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {booking.status !== "cancelled" && booking.paymentStatus === "unpaid" && (
              <div className="card-lux p-6">
                <p className="eyebrow">Payment</p>
                {payment ? (
                  <div className="mt-4">
                    {payment.demo ? (
                      <Button onClick={() => onPaid(null).catch((e: Error) => setNotice(e.message))}>
                        Pay {formatUSD(payment.amount)} (demo)
                      </Button>
                    ) : payment.clientSecret ? (
                      <StripePayment clientSecret={payment.clientSecret} amount={payment.amount} bookingRef={booking.bookingRef} onPaid={(id) => onPaid(id)} />
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <p className="text-sm text-ivory-dim">This booking isn&apos;t paid yet. Pay now to confirm your chauffeur.</p>
                    <Button onClick={beginPayment} loading={paying}>
                      Pay & confirm
                    </Button>
                  </div>
                )}
              </div>
            )}

            {result.cancellation.allowed && booking.status !== "cancelled" && (
              <div className="card-lux p-6">
                <p className="eyebrow">Cancellation</p>
                <p className="mt-3 text-sm text-ivory-dim">{result.cancellation.reason}</p>
                {confirmCancel ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-ivory">
                      {result.cancellation.refundAmount > 0
                        ? `Cancel and refund ${formatUSD(result.cancellation.refundAmount)}?`
                        : booking.paymentStatus === "paid"
                          ? "Cancel without a refund?"
                          : "Cancel this booking?"}
                    </p>
                    <Button variant="danger" size="sm" onClick={doCancel} loading={cancelling}>
                      Yes, cancel
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                      Keep booking
                    </Button>
                  </div>
                ) : (
                  <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirmCancel(true)}>
                    <XCircle className="h-4 w-4" /> Cancel booking
                  </Button>
                )}
              </div>
            )}

            <p className="text-center text-xs text-muted">
              Questions about your ride? Call dispatch 24/7 at{" "}
              <a href={`tel:${telHref(BRAND.phone)}`} className="text-gold">
                {BRAND.phone}
              </a>
              {booking.airportCode ? ` · ${getAirport(booking.airportCode)?.shortName}` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={muted ? "text-muted line-through" : "text-ivory"}>{v}</dd>
    </div>
  );
}
