import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { mapPgError } from "@/lib/api-error";

// Create a category (used by the editor's inline "+ Add new"). Contributors
// (authors + admins) — inline taxonomy creation is allowed while writing.
// Deleting categories stays admin-only (see [id]/route.ts). Written with the
// secret key since the client `authenticated` role isn't granted category writes.
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
    .from("categories")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();

  if (error) {
    return mapPgError(error, "A category with that name already exists.");
  }
  return NextResponse.json({ category: data });
}
