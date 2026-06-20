import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Server-side Supabase client for Server Components, Route Handlers, and Server
// Actions. Still uses the publishable key (RLS-constrained) but reads the user's
// session from cookies so queries run as the logged-in user.
//
// Note: in Next.js 15 `cookies()` is async, so this is an async factory —
// call it with `await createClient()`.
//
// Typed as SupabaseClient<Database> so query results infer their row types at
// every call site. (Older @supabase/ssr versions didn't thread the Database
// generic to postgrest-js and needed an explicit cast here; fixed as of 0.12.)
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore when middleware refreshes the session.
          }
        },
      },
    },
  );
}
