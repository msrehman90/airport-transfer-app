const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

import { BRAND } from "./config";

/** Generates a human-friendly booking reference such as "PR-7K4QX2". */
export function generateBookingRef(prefix: string = BRAND.refPrefix): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${code}`;
}

export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
