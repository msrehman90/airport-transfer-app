import { NextResponse } from "next/server";
import { z } from "zod";
import { BOOKING_STATUSES } from "@/lib/config";
import { serverEnv } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { getBookingById, updateBooking } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    status: z.enum(BOOKING_STATUSES).optional(),
    driverId: z.string().uuid().nullable().optional(),
    vehicleId: z.string().uuid().nullable().optional(),
    finalFare: z.number().min(0).max(100_000).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();

/** PATCH /api/admin/bookings/[id] — assign driver/vehicle, change status, override final fare. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin"))) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) return jsonError("Demo Mode: bookings live in the browser.", 409, { demo: true });
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const patch = patchSchema.parse(body);
    const existing = await getBookingById(id);
    if (!existing) return jsonError("Booking not found.", 404);
    if (existing.paymentStatus === "paid" && patch.finalFare != null && patch.finalFare !== existing.finalFare) {
      return jsonError("This booking is already paid; refund or charge the difference in Stripe.", 409);
    }
    const next = { ...patch };
    // Assigning a driver to a confirmed ride moves it to "assigned".
    if (patch.driverId && !patch.status && (existing.status === "confirmed" || existing.status === "pending")) {
      next.status = "assigned";
    }
    const updated = await updateBooking(id, next);
    return NextResponse.json({ booking: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
