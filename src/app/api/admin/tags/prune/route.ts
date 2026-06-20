import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";
import { revalidateTagDeletion } from "@/lib/revalidate";

// Remove every tag that no longer has any post_tags link ("remove all unused").
// Admin only. Unused tags only ever rendered an empty listing page, so deleting
// them is safe; their pages 404 afterwards.
export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const admin = createAdminClient();
  const [tagsRes, linksRes] = await Promise.all([
    admin.from("tags").select("id, slug"),
    admin.from("post_tags").select("tag_id"),
  ]);
  if (tagsRes.error) {
    return NextResponse.json({ error: tagsRes.error.message }, { status: 500 });
  }

  const used = new Set(
    ((linksRes.data ?? []) as { tag_id: string }[]).map((l) => l.tag_id),
  );
  const orphans = ((tagsRes.data ?? []) as { id: string; slug: string }[]).filter(
    (t) => !used.has(t.id),
  );
  if (orphans.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const { error } = await admin
    .from("tags")
    .delete()
    .in(
      "id",
      orphans.map((t) => t.id),
    );
  if (error) {
    return serverError(error);
  }

  revalidateTagDeletion(orphans.map((t) => t.slug));
  return NextResponse.json({ ok: true, removed: orphans.length });
}
