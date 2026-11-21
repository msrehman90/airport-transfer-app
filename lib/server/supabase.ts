import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";

let client: SupabaseClient | null = null;

/** Service-role Supabase client (server only). Returns null in Demo Mode. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!serverEnv.supabaseReady()) return null;
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured");
  return sb;
}
