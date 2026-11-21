import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { handleRouteError, jsonError } from "@/lib/server/http";
import { getFlatRates, getVehicleClasses, listBookings, listDrivers, listFleetVehicles } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** GET /api/admin/data — everything the dispatch dashboard needs. */
export async function GET() {
  if (!(await requireRole("admin"))) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) return jsonError("Demo Mode: dashboard data lives in the browser.", 409, { demo: true });
  try {
    const [bookings, drivers, vehicles, vehicleClasses, flatRates] = await Promise.all([
      listBookings(),
      listDrivers(),
      listFleetVehicles(),
      getVehicleClasses(),
      getFlatRates(),
    ]);
    return NextResponse.json({ bookings, drivers, vehicles, vehicleClasses, flatRates });
  } catch (err) {
    return handleRouteError(err);
  }
}
