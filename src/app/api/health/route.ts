import { NextResponse } from "next/server";

// Lightweight liveness probe for uptime monitoring (e.g. BetterStack). It does
// NO database / Supabase work and triggers no ISR, so it can be polled
// frequently without adding load — it only confirms the Worker is up and
// serving requests. It's also excluded from the session-refresh middleware (see
// the matcher in src/middleware.ts). Point your uptime monitor here instead of
// the homepage, which is a heavy ISR + DB page.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
