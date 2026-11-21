import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "../env";

export type Role = "admin" | "driver";

export interface Session {
  role: Role;
  driverId?: string;
  exp: number;
}

export const SESSION_COOKIE = "cec_session";
const SESSION_HOURS = 12;

function sign(payload: string): string {
  return createHmac("sha256", serverEnv.sessionSecret()).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function encodeSession(session: Omit<Session, "exp">): { value: string; maxAge: number } {
  const maxAge = SESSION_HOURS * 3600;
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + maxAge * 1000 })).toString("base64url");
  return { value: `${payload}.${sign(payload)}`, maxAge };
}

export function decodeSession(value: string | undefined): Session | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (session.role !== "admin" && session.role !== "driver") return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/** Returns the session if it has the given role (admins may also act as any driver). */
export async function requireRole(role: Role): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === role) return session;
  if (role === "driver" && session.role === "admin") return session;
  return null;
}

export function checkPasscode(role: Role, passcode: string): boolean {
  const expected = role === "admin" ? serverEnv.adminPasscode() : serverEnv.driverPasscode();
  return safeEqual(passcode, expected);
}
