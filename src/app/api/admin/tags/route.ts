import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { mapPgError } from "@/lib/api-error";

// Create a tag. Tags are normally auto-created when typed on a post; this lets an
// admin pre-create one from the Tags manage page. Contributor-gated (same as the
// editor's inline tag creation). A tag with no posts shows as "unused" until a
// post uses it. Deleting/pruning stays admin-only (see [id] + prune routes).
export async function POST(req: NextRequest) {
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const o = await parseJson(req);
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json(
      { error: "Name must contain letters or numbers" },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tags")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();

  if (error) {
    return mapPgError(error, "A tag with that name already exists.");
  }
  return NextResponse.json({ tag: data });
}
