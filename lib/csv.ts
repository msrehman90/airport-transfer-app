import { SERVICE_TYPE_LABELS, getVehicleSeed } from "./config";
import { SERVICE_TIMEZONE } from "./format";
import type { BookingView } from "./types";

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Neutralise spreadsheet formula injection and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function localTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(",", "");
}

export function bookingsToCsv(bookings: BookingView[]): string {
  const header = [
    "Reference",
    "Status",
    "Payment",
    "Service",
    "Trip",
    "Pickup (ET)",
    "Adjusted pickup (ET)",
    "Return (ET)",
    "Customer",
    "Email",
    "Phone",
    "Pickup address",
    "Drop-off address",
    "Airport",
    "Zone",
    "Hours",
    "Vehicle",
    "Passengers",
    "Bags",
    "Flight",
    "Flight status",
    "Return flight",
    "Meet & Greet",
    "Child seats",
    "Estimated fare",
    "Final fare",
    "Driver",
    "Plate",
    "Notes",
    "Created (ET)",
  ];
  const rows = bookings.map((b) => [
    b.bookingRef,
    b.status,
    b.paymentStatus,
    SERVICE_TYPE_LABELS[b.serviceType],
    b.tripType,
    localTime(b.scheduledPickupAt),
    localTime(b.adjustedPickupAt),
    localTime(b.returnPickupAt),
    b.customerName,
    b.customerEmail,
    b.customerPhone,
    b.pickupAddress,
    b.dropoffAddress,
    b.airportCode,
    b.cityZone,
    b.hoursBooked,
    getVehicleSeed(b.vehicleSlug)?.name ?? b.vehicleSlug,
    b.passengers,
    b.luggage,
    b.flightNumber,
    b.flightStatus,
    b.returnFlightNumber,
    b.meetAndGreet ? "Yes" : "No",
    b.childSeats,
    b.estimatedFare.toFixed(2),
    b.finalFare != null ? b.finalFare.toFixed(2) : "",
    b.driver?.fullName,
    b.vehicle?.plateNumber,
    b.notes,
    localTime(b.createdAt),
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
