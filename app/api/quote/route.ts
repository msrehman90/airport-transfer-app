import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { resolveQuote } from "@/lib/server/quote";
import { tripSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  trip: tripSchema,
  demoFlatRateOverrides: z.record(z.string(), z.number().positive()).optional().nullable(),
});

/** POST /api/quote — validates a trip and returns a server-computed, itemised fare. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { trip, demoFlatRateOverrides } = bodySchema.parse(body);
    const demoOnly = !serverEnv.supabaseReady() && !serverEnv.stripeReady();
    const quote = await resolveQuote(trip, {
      demoFlatRateOverrides: demoOnly ? demoFlatRateOverrides : null,
    });
    return NextResponse.json({ quote });
  } catch (err) {
    return handleRouteError(err);
  }
}
