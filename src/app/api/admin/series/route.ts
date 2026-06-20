import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { mapPgError } from "@/lib/api-error";

// Create a series (used by the editor's inline "+ Add new"). Contributors
// (authors + admins). Renaming/deleting series stays admin-only ([id]/route.ts).
export async function POST(req: NextRequest) {
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const o = await parseJson(req);
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const slug = slugify(title);
  if (!slug) {
    return NextResponse.json(
      { error: "Title must contain letters or numbers" },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("series")
    .insert({ title, slug })
    .select("id, title, slug")
    .single();
  if (error) {
    return mapPgError(error, "A series with that name already exists.");
  }
  return NextResponse.json({ series: data });
}
