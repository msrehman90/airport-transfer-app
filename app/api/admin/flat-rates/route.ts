import { NextResponse } from "next/server";
import { z } from "zod";
import { AIRPORTS, CITY_ZONES } from "@/lib/config";
import { serverEnv } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { getFlatRates, upsertFlatRate } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const rateSchema = z.object({
  airportCode: z.enum(AIRPORTS.map((a) => a.code) as [string, ...string[]]),
  cityZone: z.enum(CITY_ZONES.map((z) => z.slug) as [string, ...string[]]),
  vehicleClassId: z.string().uuid(),
  oneWayFare: z.number().positive().max(10_000),
});

/** PUT /api/admin/flat-rates — create or update one zone ↔ airport flat rate. */
export async function PUT(request: Request) {
  if (!(await requireRole("admin"))) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) return jsonError("Demo Mode: rates live in the browser.", 409, { demo: true });
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const input = rateSchema.parse(body);
    await upsertFlatRate(input);
    return NextResponse.json({ flatRates: await getFlatRates() });
  } catch (err) {
    return handleRouteError(err);
  }
}
