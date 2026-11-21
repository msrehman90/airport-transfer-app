import { NextResponse } from "next/server";
import { z } from "zod";
import { computePickupAdjustment, getFlightStatus } from "@/lib/server/flights";
import { handleRouteError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  flight: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(v), "Invalid flight number"),
  scheduled: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});

/**
 * GET /api/flights?flight=UA1234&scheduled=ISO — live (AirLabs) or simulated
 * flight status plus the pickup adjustment it would cause.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { flight, scheduled } = querySchema.parse({
      flight: params.get("flight") ?? "",
      scheduled: params.get("scheduled"),
    });
    const status = await getFlightStatus(flight, scheduled ?? null);
    const adjustment = scheduled ? computePickupAdjustment(scheduled, status) : null;
    return NextResponse.json({ flight: status, adjustment });
  } catch (err) {
    return handleRouteError(err);
  }
}
