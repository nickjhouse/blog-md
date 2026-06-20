import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// OAuth / PKCE code-exchange callback. Used by Google sign-in and any
// code-based email flow. Exchanges the ?code for a cookie session.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Guard against open-redirect: only same-origin relative paths are honored.
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // New OAuth users have no username yet — route them to choose one before
      // continuing (commenting requires a username).
      const { data: claims } = await supabase.auth.getClaims();
      const sub = (claims?.claims as { sub?: string } | undefined)?.sub;
      if (sub) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", sub)
          .maybeSingle();
        const displayName = (profile as { display_name: string | null } | null)
          ?.display_name;
        if (!displayName) {
          return NextResponse.redirect(
            new URL(
              `/welcome?next=${encodeURIComponent(next)}`,
              request.url,
            ),
          );
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Could+not+sign+in", request.url),
  );
}
