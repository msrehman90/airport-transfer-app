/**
 * Feature detection for optional integrations. Anything that is not configured
 * falls back to Demo Mode so the app runs with zero keys.
 *
 * NEXT_PUBLIC_* values are inlined at build time and safe to read on the client.
 * The server-only helpers must only be imported from server code.
 */

function has(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Client-safe flags (inlined at build time). */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supabaseEnabled: has(process.env.NEXT_PUBLIC_SUPABASE_URL) && has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  googleMapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
};

/** Server-side configuration checks. */
export const serverEnv = {
  supabaseReady(): boolean {
    return (
      has(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      has(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );
  },
  stripeReady(): boolean {
    return has(process.env.STRIPE_SECRET_KEY) && has(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  },
  googleMapsReady(): boolean {
    return has(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  },
  airlabsReady(): boolean {
    return has(process.env.AIRLABS_API_KEY);
  },
  resendReady(): boolean {
    return has(process.env.RESEND_API_KEY);
  },
  adminPasscode(): string {
    return process.env.ADMIN_PASSCODE || "admin123";
  },
  driverPasscode(): string {
    return process.env.DRIVER_PASSCODE || "driver123";
  },
  sessionSecret(): string {
    return (
      process.env.SESSION_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.STRIPE_SECRET_KEY ||
      "demo-session-secret-change-me"
    );
  },
  fromEmail(): string {
    return process.env.FROM_EMAIL || "bookings@example.com";
  },
  dispatchEmail(): string {
    return process.env.DISPATCH_EMAIL || process.env.FROM_EMAIL || "dispatch@example.com";
  },
  siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  },
};
