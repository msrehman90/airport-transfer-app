import "server-only";
import { BRAND, SERVICE_TYPE_LABELS, getVehicleSeed } from "../config";
import { serverEnv } from "../env";
import { formatDateLong as formatDateTime } from "../format";
import { formatUSD } from "../pricing";
import type { Booking, QuoteLineItem } from "../types";

interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/** Sends email through Resend's HTTP API; logs to the console when no key is set. */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; id?: string }> {
  const to = Array.isArray(message.to) ? message.to : [message.to];
  if (!serverEnv.resendReady()) {
    console.info(`[email:demo] To: ${to.join(", ")} | ${message.subject}\n${message.text}`);
    return { sent: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND.name} <${serverEnv.fromEmail()}>`,
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text());
      return { sent: false };
    }
    const data = (await res.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tripRows(b: Booking): [string, string][] {
  const rows: [string, string][] = [
    ["Booking reference", b.bookingRef],
    ["Service", SERVICE_TYPE_LABELS[b.serviceType]],
    ["Vehicle", getVehicleSeed(b.vehicleSlug)?.name ?? b.vehicleSlug],
    ["Pickup time", formatDateTime(b.scheduledPickupAt)],
    ["Pickup", b.pickupAddress],
  ];
  if (b.dropoffAddress) rows.push(["Drop-off", b.dropoffAddress]);
  if (b.hoursBooked) rows.push(["Hours", String(b.hoursBooked)]);
  if (b.flightNumber) rows.push(["Flight", b.flightNumber]);
  if (b.tripType === "round_trip") {
    rows.push(["Return pickup", formatDateTime(b.returnPickupAt)]);
    if (b.returnFlightNumber) rows.push(["Return flight", b.returnFlightNumber]);
  }
  rows.push(["Passengers / bags", `${b.passengers} / ${b.luggage}`]);
  return rows;
}

function layout(title: string, intro: string, rows: [string, string][], lineItems: QuoteLineItem[], total: number, footer: string) {
  const site = serverEnv.siteUrl();
  const html = `<!doctype html><html><body style="margin:0;background:#0b0b0c;font-family:Arial,Helvetica,sans-serif;color:#f5f1e8">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#141416;border:1px solid #2a2a2e;border-radius:12px;padding:32px">
<tr><td style="font-size:12px;letter-spacing:3px;color:#c9a24b;text-transform:uppercase">${escapeHtml(BRAND.name)}</td></tr>
<tr><td style="font-size:24px;padding:12px 0 8px;color:#f5f1e8">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:14px;color:#bdb6a6;padding-bottom:20px">${escapeHtml(intro)}</td></tr>
<tr><td><table width="100%" cellpadding="6" style="font-size:14px;border-collapse:collapse">
${rows.map(([k, v]) => `<tr><td style="color:#8f897c;width:40%;border-bottom:1px solid #222">${escapeHtml(k)}</td><td style="border-bottom:1px solid #222">${escapeHtml(v)}</td></tr>`).join("")}
</table></td></tr>
<tr><td style="padding-top:20px"><table width="100%" cellpadding="6" style="font-size:14px">
${lineItems.map((li) => `<tr><td style="color:#bdb6a6">${escapeHtml(li.label)}</td><td align="right">${formatUSD(li.amount)}</td></tr>`).join("")}
<tr><td style="font-weight:bold;color:#c9a24b;border-top:1px solid #333">Total</td><td align="right" style="font-weight:bold;color:#c9a24b;border-top:1px solid #333">${formatUSD(total)}</td></tr>
</table></td></tr>
<tr><td style="font-size:13px;color:#8f897c;padding-top:20px">${escapeHtml(footer)}</td></tr>
<tr><td style="padding-top:20px"><a href="${site}/track" style="background:#c9a24b;color:#0b0b0c;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;font-size:14px">Manage your booking</a></td></tr>
<tr><td style="font-size:12px;color:#6c675d;padding-top:24px">${escapeHtml(BRAND.phone)} · ${escapeHtml(BRAND.email)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `${BRAND.name} — ${title}`,
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    ...lineItems.map((li) => `${li.label}: ${formatUSD(li.amount)}`),
    `Total: ${formatUSD(total)}`,
    "",
    footer,
    `Manage your booking: ${site}/track`,
  ].join("\n");
  return { html, text };
}

const POLICY =
  "Free cancellation up to 24 hours before pickup. If your airline cancels your flight, you get a 100% refund or free rebooking.";

export async function sendQuoteEmail(b: Booking, lineItems: QuoteLineItem[]) {
  const { html, text } = layout(
    "Your quote",
    `Here is your quote, reference ${b.bookingRef}. It is held for 7 days. Reply to this email or book online to confirm.`,
    tripRows(b),
    lineItems,
    b.estimatedFare,
    POLICY,
  );
  return sendEmail({ to: b.customerEmail, subject: `Your quote ${b.bookingRef} — ${formatUSD(b.estimatedFare)}`, html, text });
}

export async function sendConfirmationEmail(b: Booking, lineItems: QuoteLineItem[]) {
  const { html, text } = layout(
    "Your ride is confirmed",
    `Thank you, ${b.customerName}. Your chauffeur will be assigned shortly. We track your flight and adjust pickup for delays automatically.`,
    tripRows(b),
    lineItems,
    b.finalFare ?? b.estimatedFare,
    POLICY,
  );
  await Promise.all([
    sendEmail({ to: b.customerEmail, subject: `Booking confirmed — ${b.bookingRef}`, html, text }),
    sendEmail({
      to: serverEnv.dispatchEmail(),
      subject: `New booking ${b.bookingRef} — ${formatDateTime(b.scheduledPickupAt)}`,
      html,
      text,
    }),
  ]);
}

export async function sendCancellationEmail(b: Booking, refundAmount: number, reason: string) {
  const rows = tripRows(b);
  const { html, text } = layout(
    "Booking cancelled",
    `${reason} ${refundAmount > 0 ? `A refund of ${formatUSD(refundAmount)} is on its way to your card.` : ""}`.trim(),
    rows,
    [],
    refundAmount,
    "We hope to drive you again soon.",
  );
  await Promise.all([
    sendEmail({ to: b.customerEmail, subject: `Booking cancelled — ${b.bookingRef}`, html, text }),
    sendEmail({ to: serverEnv.dispatchEmail(), subject: `CANCELLED ${b.bookingRef}`, html, text }),
  ]);
}

export async function sendFlightAlertEmail(
  b: Booking,
  driverEmail: string | null,
  flightStatus: string,
  newPickupIso: string,
) {
  const subject = `Flight ${b.flightNumber} ${flightStatus.toUpperCase()} — ${b.bookingRef} pickup now ${formatDateTime(newPickupIso)}`;
  const text = [
    subject,
    `Customer: ${b.customerName} (${b.customerPhone})`,
    `Original pickup: ${formatDateTime(b.scheduledPickupAt)}`,
    `Adjusted pickup: ${formatDateTime(newPickupIso)}`,
    `Pickup: ${b.pickupAddress}`,
  ].join("\n");
  const html = `<pre style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(text)}</pre>`;
  const recipients = [serverEnv.dispatchEmail(), ...(driverEmail ? [driverEmail] : [])];
  return sendEmail({ to: recipients, subject, html, text });
}
