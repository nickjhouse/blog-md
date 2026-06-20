import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";

// Add a custom filter term (block or allow) — admin only.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const term = typeof o.term === "string" ? o.term.trim().toLowerCase() : "";
  const kind = o.kind === "allow" ? "allow" : "block";
  if (!term) {
    return NextResponse.json({ error: "Term is required." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("moderation_terms")
    .insert({ term, kind })
    .select("id, term, kind")
    .single();
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    const message =
      error.code === "23505" ? "That term already exists." : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ term: data });
}
