import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { handleRouteError, jsonError } from "@/lib/server/http";
import { getDriver, listDriverRides } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** GET /api/driver/rides — rides assigned to the signed-in driver. */
export async function GET() {
  const session = await requireRole("driver");
  if (!session || session.role !== "driver" || !session.driverId) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) return jsonError("Demo Mode: rides live in the browser.", 409, { demo: true });
  try {
    const [driver, rides] = await Promise.all([getDriver(session.driverId), listDriverRides(session.driverId)]);
    if (!driver) return jsonError("Driver not found.", 404);
    return NextResponse.json({ driver, rides });
  } catch (err) {
    return handleRouteError(err);
  }
}
