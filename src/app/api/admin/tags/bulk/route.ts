import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";
import { revalidateTagDeletion } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

// Bulk-delete tags — admin only. Mirrors the single DELETE: the post_tags FK is
// ON DELETE CASCADE, so links vanish and posts simply lose the chip (not deleted).
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const ids = Array.isArray(o.ids)
    ? [...new Set(o.ids.filter((v): v is string => typeof v === "string"))]
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: "No tags selected." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Capture tag slugs + the slugs of posts carrying them BEFORE delete, so the
  // now-404 tag pages and those post pages get revalidated.
  const [{ data: tagRows }, { data: links }] = await Promise.all([
    admin.from("tags").select("slug").in("id", ids),
    admin.from("post_tags").select("post:posts(slug)").in("tag_id", ids),
  ]);

  const { error } = await admin.from("tags").delete().in("id", ids);
  if (error) return serverError(error);

  const slugs = (tagRows ?? []).map((t) => t.slug);
  const postSlugs: string[] = [];
  for (const r of links ?? []) {
    const p = Array.isArray(r.post) ? r.post[0] : r.post;
    if (p?.slug) postSlugs.push(p.slug);
  }
  revalidateTagDeletion(slugs, postSlugs);
  return NextResponse.json({ ok: true });
}
