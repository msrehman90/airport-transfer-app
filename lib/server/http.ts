import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { firstZodError, zodFieldErrors } from "../validation";
import { QuoteError } from "./quote";

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Converts known error types into consistent JSON API errors. */
export function handleRouteError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(firstZodError(err), 400, { fieldErrors: zodFieldErrors(err) });
  }
  if (err instanceof QuoteError) {
    return jsonError(err.message, err.status, err.field ? { fieldErrors: { [err.field]: err.message } } : {});
  }
  console.error("[api] unexpected error", err);
  return jsonError("Something went wrong. Please try again or call us.", 500);
}
