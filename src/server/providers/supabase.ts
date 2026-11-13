// Connection to a Supabase project, for the optional Supabase providers
// (sign-in for judges, file storage). Not needed to use Supabase as the
// database: that only takes DATABASE_URL.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function need(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. It's required by the Supabase provider.`);
  return value;
}

const options = { auth: { autoRefreshToken: false, persistSession: false } };

/**
 * Full access, using the project's secret key. Server-side only: this key
 * must never reach a browser.
 */
export function supabaseAdmin(): SupabaseClient {
  return createClient(need("SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), options);
}

/**
 * The same access a visitor has, using the publishable key. Used to check a
 * password the way a browser sign-in would.
 */
export function supabasePublic(): SupabaseClient {
  return createClient(need("SUPABASE_URL"), need("SUPABASE_PUBLISHABLE_KEY"), options);
}
