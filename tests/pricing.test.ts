import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_FLAT_RATES, VEHICLE_CLASSES, getVehicleSeed } from "../lib/config";
import { zonedLocalToIso, isoToZonedLocal } from "../lib/format";
import { evaluateCancellation } from "../lib/policy";
import { calculateQuote } from "../lib/pricing";
import { contactMatches } from "../lib/validation";

const sedan = getVehicleSeed("sedan")!;
const sprinter = getVehicleSeed("sprinter")!;

describe("calculateQuote", () => {
  it("has at least 10 vehicle classes with unique slugs", () => {
    assert.ok(VEHICLE_CLASSES.length >= 10);
    assert.equal(new Set(VEHICLE_CLASSES.map((v) => v.slug)).size, VEHICLE_CLASSES.length);
  });

  it("prices hourly with the 3-hour minimum", () => {
    const q = calculateQuote({ serviceType: "hourly", tripType: "one_way", hours: 2, vehicle: sedan, meetAndGreet: false, childSeats: 0 });
    assert.equal(q.totalFare, 210);
    assert.equal(q.pricingMethod, "hourly");
  });

  it("ignores round trip for hourly", () => {
    const q = calculateQuote({ serviceType: "hourly", tripType: "round_trip", hours: 4, vehicle: sprinter, meetAndGreet: false, childSeats: 0 });
    assert.equal(q.tripMultiplier, 1);
    assert.equal(q.totalFare, 580);
  });

  it("uses the flat rate for airport transfers and doubles round trips", () => {
    const q = calculateQuote({
      serviceType: "from_airport",
      tripType: "round_trip",
      flatRateOneWay: 65,
      distanceMiles: 999,
      vehicle: sedan,
      meetAndGreet: true,
      childSeats: 2,
    });
    assert.equal(q.pricingMethod, "flat_rate");
    assert.equal(q.totalFare, 65 * 2 + 25 + 30);
  });

  it("falls back to distance pricing when no flat rate exists", () => {
    const q = calculateQuote({
      serviceType: "to_airport",
      tripType: "one_way",
      flatRateOneWay: null,
      distanceMiles: 20,
      vehicle: sedan,
      meetAndGreet: false,
      childSeats: 0,
    });
    assert.equal(q.pricingMethod, "distance");
    assert.equal(q.totalFare, 45 + 20 * 3.5);
  });

  it("never goes negative on bad input", () => {
    const q = calculateQuote({
      serviceType: "point_to_point",
      tripType: "one_way",
      distanceMiles: -10,
      vehicle: sedan,
      meetAndGreet: false,
      childSeats: -3,
    });
    assert.equal(q.totalFare, 45);
  });
});

describe("flat-rate seed", () => {
  it("covers every vehicle class for every zone/airport pair", () => {
    assert.equal(DEFAULT_FLAT_RATES.length % VEHICLE_CLASSES.length, 0);
    const dcaDowntown = new Map(
      DEFAULT_FLAT_RATES.filter((r) => r.airportCode === "DCA" && r.cityZone === "dc_downtown").map((r) => [r.vehicleSlug, r.oneWayFare]),
    );
    assert.equal(dcaDowntown.size, VEHICLE_CLASSES.length);
    assert.equal(dcaDowntown.get("sedan"), 65);
    assert.equal(dcaDowntown.get("suv"), 85);
    assert.equal(dcaDowntown.get("escalade"), 105);
    assert.equal(dcaDowntown.get("sprinter"), 145);
    assert.equal(dcaDowntown.get("ultra_luxury_sedan"), 230);
  });
});

describe("cancellation policy", () => {
  const base = {
    status: "confirmed" as const,
    flightStatus: null,
    paymentStatus: "paid" as const,
    estimatedFare: 100,
    finalFare: 100,
  };
  const now = new Date("2026-12-01T12:00:00Z");

  it("refunds in full 24h+ before pickup", () => {
    const d = evaluateCancellation({ ...base, scheduledPickupAt: "2026-12-02T13:00:00Z" }, now);
    assert.equal(d.refundable, true);
    assert.equal(d.refundAmount, 100);
  });

  it("is non-refundable inside 24h", () => {
    const d = evaluateCancellation({ ...base, scheduledPickupAt: "2026-12-02T11:00:00Z" }, now);
    assert.equal(d.allowed, true);
    assert.equal(d.refundable, false);
  });

  it("refunds when the airline cancels, even inside 24h", () => {
    const d = evaluateCancellation({ ...base, flightStatus: "cancelled", scheduledPickupAt: "2026-12-01T13:00:00Z" }, now);
    assert.equal(d.refundAmount, 100);
  });

  it("blocks cancelling completed rides", () => {
    const d = evaluateCancellation({ ...base, status: "completed", scheduledPickupAt: "2026-12-05T13:00:00Z" }, now);
    assert.equal(d.allowed, false);
  });
});

describe("time zone helpers", () => {
  it("converts Eastern local time to UTC across DST", () => {
    assert.equal(zonedLocalToIso("2026-07-04T10:00"), "2026-07-04T14:00:00.000Z");
    assert.equal(zonedLocalToIso("2026-12-24T10:00"), "2026-12-24T15:00:00.000Z");
    assert.equal(isoToZonedLocal("2026-12-24T15:00:00.000Z"), "2026-12-24T10:00");
  });
});

describe("contactMatches", () => {
  it("matches email case-insensitively and phone by digits", () => {
    assert.equal(contactMatches("Avery@Example.com", "avery@example.com", "+1 (202) 555-0110"), true);
    assert.equal(contactMatches("202-555-0110", "x@y.z", "+1 (202) 555-0110"), true);
    assert.equal(contactMatches("555", "x@y.z", "+1 (202) 555-0110"), false);
    assert.equal(contactMatches("other@example.com", "avery@example.com", "+1"), false);
  });
});
