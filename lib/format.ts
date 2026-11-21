/** Date helpers. All pickup times are entered and shown in the service area's time zone. */

export const SERVICE_TIMEZONE = "America/New_York";

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** "2026-12-01T14:30" in the service time zone → UTC ISO string. */
export function zonedLocalToIso(local: string, timeZone = SERVICE_TIMEZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const offset = tzOffsetMs(guess, timeZone);
  let ts = guess - offset;
  const offset2 = tzOffsetMs(ts, timeZone);
  if (offset2 !== offset) ts = guess - offset2;
  return new Date(ts).toISOString();
}

/** UTC ISO string → "YYYY-MM-DDTHH:mm" in the service time zone (for datetime-local inputs). */
export function isoToZonedLocal(iso: string, timeZone = SERVICE_TIMEZONE): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const shifted = new Date(ms + tzOffsetMs(ms, timeZone));
  return shifted.toISOString().slice(0, 16);
}

export function formatDateTime(iso: string | null | undefined, opts: { withZone?: boolean } = {}): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SERVICE_TIMEZONE,
    ...(opts.withZone === false ? {} : { timeZoneName: "short" }),
  }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SERVICE_TIMEZONE,
  }).format(new Date(iso));
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SERVICE_TIMEZONE,
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Default pickup: tomorrow at 10:00 service time, as a datetime-local value. */
export function defaultPickupLocal(daysAhead = 1, hour = 10): string {
  const now = isoToZonedLocal(new Date().toISOString());
  const d = new Date(`${now.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}
