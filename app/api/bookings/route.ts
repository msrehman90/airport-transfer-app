import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { buildBooking, publicBooking } from "@/lib/server/bookings";
import { sendQuoteEmail } from "@/lib/server/email";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { resolveQuote } from "@/lib/server/quote";
import { insertBooking } from "@/lib/server/repo";
import { bookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  booking: bookingSchema,
  demoFlatRateOverrides: z.record(z.string(), z.number().positive()).optional().nullable(),
});

/**
 * POST /api/bookings — creates a pending booking (or saved quote) with a
 * server-computed fare and unique booking_ref.
 *
 * Demo Mode (no Supabase): the booking is built and priced here but returned to
 * the browser to be stored in LocalStorage.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { booking: input, demoFlatRateOverrides } = bodySchema.parse(body);
    const demoOnly = !serverEnv.supabaseReady() && !serverEnv.stripeReady();
    const quote = await resolveQuote(input.trip, {
      requireAddresses: true,
      demoFlatRateOverrides: demoOnly ? demoFlatRateOverrides : null,
    });
    const draft = buildBooking(input, quote);

    if (!serverEnv.supabaseReady()) {
      if (input.mode === "quote") await sendQuoteEmail(draft, quote.lineItems);
      return NextResponse.json({ booking: draft, quote, demo: true }, { status: 201 });
    }

    const saved = await insertBooking(draft);
    let emailed = false;
    if (input.mode === "quote") {
      emailed = (await sendQuoteEmail(saved, quote.lineItems)).sent;
    }
    return NextResponse.json({ booking: publicBooking(saved), quote, emailed, demo: false }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
