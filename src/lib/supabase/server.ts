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
// The return type is annotated as `SupabaseClient<Database>` on purpose:
// @supabase/ssr@0.5 doesn't thread the `Database` generic through to the newer
// postgrest-js, so reads off the raw client infer as `never`. Re-asserting the
// typed client here — once, at the factory — fixes inference at every call site
// and removes the need for an `as unknown as` cast on each read.
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
  ) as unknown as SupabaseClient<Database>;
}
