import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Cookieless public client (publishable key, no session) for public,
// non-personalized reads like the sitemap and OG-image routes. Uses supabase-js
// directly so the Database generic is applied (the @supabase/ssr clients don't
// forward it). RLS still restricts to published/visible rows.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
