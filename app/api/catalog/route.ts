import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { handleRouteError } from "@/lib/server/http";
import { getFlatRates, getVehicleClasses } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** GET /api/catalog — public vehicle classes and flat-rate table. */
export async function GET() {
  try {
    const [vehicleClasses, flatRates] = await Promise.all([getVehicleClasses(), getFlatRates()]);
    return NextResponse.json({
      vehicleClasses,
      flatRates,
      integrations: {
        supabase: serverEnv.supabaseReady(),
        stripe: serverEnv.stripeReady(),
        googleMaps: serverEnv.googleMapsReady(),
        airlabs: serverEnv.airlabsReady(),
        email: serverEnv.resendReady(),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
