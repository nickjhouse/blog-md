import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { revalidateSeries } from "@/lib/revalidate";
import { mapPgError, serverError } from "@/lib/api-error";

// Member post slugs for a series — used to revalidate each member's page (its
// SeriesNav shows the series title/links).
async function memberPostSlugs(
  db: ReturnType<typeof createAdminClient>,
  seriesId: string,
): Promise<string[]> {
  const { data } = await db
    .from("posts")
    .select("slug")
    .eq("series_id", seriesId);
  return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
}

type Ctx = { params: Promise<{ id: string }> };

// Rename a series (updates its slug too). Admin only.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

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
  // Capture the old slug + members BEFORE the rename so we can invalidate the
  // old /series/<slug> URL and each member post's SeriesNav.
  const { data: prior } = await supabaseAdmin
    .from("series")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const members = await memberPostSlugs(supabaseAdmin, id);
  const { error } = await supabaseAdmin
    .from("series")
    .update({ title, slug })
    .eq("id", id);
  if (error) {
    return mapPgError(error, "A series with that name already exists.");
  }
  const formerSlug = (prior as { slug: string } | null)?.slug ?? null;
  revalidateSeries({
    slugs: [slug, formerSlug ?? ""],
    memberPostSlugs: members,
  });
  return NextResponse.json({ ok: true });
}

// Delete a series — admin only. Posts in it are NOT deleted; their series_id is
// set to NULL by the foreign-key constraint.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const supabaseAdmin = createAdminClient();
  // Capture slug + members BEFORE delete: the FK nulls members' series_id, so we
  // must refresh each member's SeriesNav and the old /series/<slug> URL.
  const { data: prior } = await supabaseAdmin
    .from("series")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const members = await memberPostSlugs(supabaseAdmin, id);
  const { error } = await supabaseAdmin.from("series").delete().eq("id", id);
  if (error) {
    return serverError(error);
  }
  revalidateSeries({
    slugs: [(prior as { slug: string } | null)?.slug ?? ""],
    memberPostSlugs: members,
  });
  return NextResponse.json({ ok: true });
}
