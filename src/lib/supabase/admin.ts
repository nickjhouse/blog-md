import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ADMIN client using the SECRET key (sb_secret_...). Bypasses Row Level
// Security entirely.
//
// ⚠️  Use ONLY inside server route handlers (/api/admin/*, /api/comment),
//     and ONLY after verifying the caller is authorized. NEVER import this from
//     a Client Component or anything that ships to the browser.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
