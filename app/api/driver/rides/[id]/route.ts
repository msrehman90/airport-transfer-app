import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { getBookingById, updateBooking } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const DRIVER_FLOW = ["assigned", "en_route", "arrived", "in_progress", "completed"] as const;
const bodySchema = z.object({ status: z.enum(DRIVER_FLOW) });

/** PATCH /api/driver/rides/[id] — driver moves a ride through En Route → Arrived → On Board → Completed. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("driver");
  if (!session || session.role !== "driver" || !session.driverId) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) return jsonError("Demo Mode: rides live in the browser.", 409, { demo: true });
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { status } = bodySchema.parse(body);
    const ride = await getBookingById(id);
    if (!ride || ride.driverId !== session.driverId) return jsonError("Ride not found.", 404);
    if (ride.status === "cancelled" || ride.status === "completed") {
      return jsonError("This ride is closed.", 409);
    }
    const updated = await updateBooking(id, { status });
    return NextResponse.json({ ride: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
