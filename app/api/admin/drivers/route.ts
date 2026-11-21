import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { requireRole } from "@/lib/server/auth";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { createDriver } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const driverSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  licenseNumber: z.string().trim().max(60).optional(),
});

/** POST /api/admin/drivers — add a chauffeur to the roster. */
export async function POST(request: Request) {
  if (!(await requireRole("admin"))) return jsonError("Unauthorized", 401);
  if (!serverEnv.supabaseReady()) return jsonError("Demo Mode: drivers live in the browser.", 409, { demo: true });
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const input = driverSchema.parse(body);
    const driver = await createDriver({ ...input, email: input.email || null });
    return NextResponse.json({ driver }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
