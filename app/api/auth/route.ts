import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { SESSION_COOKIE, checkPasscode, encodeSession, getSession } from "@/lib/server/auth";
import { handleRouteError, jsonError, readJson } from "@/lib/server/http";
import { getDriver, listDrivers } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  role: z.enum(["admin", "driver"]),
  passcode: z.string().min(1).max(200),
  driverId: z.string().trim().max(100).optional().nullable(),
});

function isHttps(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

/** GET /api/auth — current session. */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session: session ? { role: session.role, driverId: session.driverId ?? null } : null });
}

/**
 * POST /api/auth — passcode sign-in for /admin and /driver.
 * Drivers: first call without driverId returns the roster (Supabase mode),
 * second call with driverId issues the session.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const { role, passcode, driverId } = loginSchema.parse(body);
    if (!checkPasscode(role, passcode)) return jsonError("Incorrect passcode.", 401);

    if (role === "driver") {
      if (!driverId) {
        const drivers = serverEnv.supabaseReady()
          ? (await listDrivers()).map((d) => ({ id: d.id, fullName: d.fullName }))
          : null;
        return NextResponse.json({ ok: true, needsDriver: true, drivers });
      }
      if (serverEnv.supabaseReady() && !(await getDriver(driverId))) {
        return jsonError("Driver not found.", 404);
      }
    }

    const { value, maxAge } = encodeSession({ role, ...(role === "driver" && driverId ? { driverId } : {}) });
    const res = NextResponse.json({ ok: true, session: { role, driverId: driverId ?? null } });
    res.cookies.set(SESSION_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps(request),
      path: "/",
      maxAge,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}

/** DELETE /api/auth — sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
