import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";
import { revalidateTagDeletion } from "@/lib/revalidate";

type Ctx = { params: Promise<{ id: string }> };

// Delete a tag — admin only. The post_tags FK is ON DELETE CASCADE, so the tag's
// links vanish and any posts that carried it simply lose the chip (posts are NOT
// deleted). Used by the Tags manage page.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const admin = createAdminClient();

  // Capture the slug + the slugs of posts that carry this tag BEFORE deleting,
  // so we can revalidate the tag's (now-404) page and those post pages.
  const { data: tag } = await admin
    .from("tags")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const { data: links } = await admin
    .from("post_tags")
    .select("post:posts(slug)")
    .eq("tag_id", id);
  const postSlugs: string[] = [];
  for (const r of links ?? []) {
    const p = Array.isArray(r.post) ? r.post[0] : r.post;
    if (p?.slug) postSlugs.push(p.slug);
  }

  const { error } = await admin.from("tags").delete().eq("id", id);
  if (error) {
    return serverError(error);
  }

  const slug = (tag as { slug: string } | null)?.slug;
  revalidateTagDeletion(slug ? [slug] : [], postSlugs);
  return NextResponse.json({ ok: true });
}
