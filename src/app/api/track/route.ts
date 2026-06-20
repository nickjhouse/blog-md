import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { parseJson } from "@/lib/route-guards";
import type { Json } from "@/lib/supabase/types";

// Only events we explicitly emit are stored — anything else is silently
// ignored so the endpoint can't be used to write arbitrary rows.
const ALLOWED = new Set(["newsletter_signup", "share", "search"]);

export async function POST(req: NextRequest) {
  // Best-effort per-IP throttle (per-isolate; see lib/rate-limit). This is the
  // one public write the free WAF rule doesn't cover. 60/min is far above any
  // human's share/search/signup rate but caps a single-client flood. Returns 429
  // (harmless to the analytics beacon, which ignores the response).
  if (!rateLimit(`track:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const o = await parseJson(req);
  const name = typeof o.name === "string" ? o.name : "";
  if (!ALLOWED.has(name)) return NextResponse.json({ ok: true });

  const path = typeof o.path === "string" ? o.path.slice(0, 512) : null;

  // Keep props tiny and primitive-only (no PII, no nested objects).
  let props: Record<string, Json> | null = null;
  if (o.props && typeof o.props === "object" && !Array.isArray(o.props)) {
    const clean: Record<string, Json> = {};
    for (const [k, v] of Object.entries(o.props as Record<string, unknown>)) {
      if (Object.keys(clean).length >= 10) break;
      if (typeof v === "string") clean[k] = v.slice(0, 120);
      else if (typeof v === "number" || typeof v === "boolean") clean[k] = v;
    }
    props = clean;
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("analytics_events")
      .insert({ name, path, props });
    if (error) console.error("[track] insert failed:", error.message);
  } catch (e) {
    // Analytics must never break the user experience.
    console.error("[track] threw:", e);
  }
  return NextResponse.json({ ok: true });
}
