import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToSafeHtml } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { maybeAutoSendNewsletter } from "@/lib/newsletter";
import { revalidatePostsShallow } from "@/lib/revalidate";
import { pruneOrphanTags } from "@/lib/admin-tags";
import { serverError } from "@/lib/api-error";
import { isLive } from "@/lib/published";

export const dynamic = "force-dynamic";

const ACTIONS = ["publish", "draft", "delete"] as const;
type Action = (typeof ACTIONS)[number];

// Bulk publish / move-to-draft / delete from the admin list. Contributor-gated;
// authors can only affect their own posts (server re-checks per id). Bulk publish
// regenerates body_html (so the latest body goes live) and is SILENT by default —
// it only sends newsletters when BOTH auto_newsletter_on_publish and
// bulk_publish_sends_newsletter are on, to avoid mass emails.
export async function POST(req: NextRequest) {
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const o = await parseJson(req);
  const ids = Array.isArray(o.ids)
    ? [...new Set(o.ids.filter((v): v is string => typeof v === "string"))]
    : [];
  const action = ACTIONS.includes(o.action as Action)
    ? (o.action as Action)
    : null;
  if (!ids.length || !action) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = createAdminClient();
  const { data } = await db
    .from("posts")
    .select("id, author_id, status, published_at, body_md, slug")
    .in("id", ids);
  let rows = data ?? [];
  // Authors may only act on their own posts.
  if (!me.isAdmin) rows = rows.filter((r) => r.author_id === me.userId);
  if (!rows.length) return NextResponse.json({ ok: true, affected: 0 });
  const targetIds = rows.map((r) => r.id);
  const targetSlugs = rows.map((r) => r.slug);

  if (action === "delete") {
    // Capture tag links before delete (FK cascade clears them) to prune orphans.
    const { data: tagLinks } = await db
      .from("post_tags")
      .select("tag_id")
      .in("post_id", targetIds);
    const tagIds = (tagLinks ?? []).map((l) => l.tag_id);
    const { error } = await db.from("posts").delete().in("id", targetIds);
    if (error) return serverError(error);
    await pruneOrphanTags(db, tagIds);
    revalidatePostsShallow(targetSlugs);
    return NextResponse.json({ ok: true, affected: targetIds.length });
  }

  if (action === "draft") {
    // Flip to draft; keep published_at so re-publishing can restore the date.
    const { error } = await db
      .from("posts")
      .update({ status: "draft" })
      .in("id", targetIds);
    if (error) return serverError(error);
    revalidatePostsShallow(targetSlugs);
    return NextResponse.json({ ok: true, affected: targetIds.length });
  }

  // publish
  const now = Date.now();
  const settings = await getSettings();
  let affected = 0;
  const transitioned: string[] = [];
  const failed: string[] = [];
  for (const r of rows) {
    const wasLive = isLive(r);
    // Publish immediately: stamp now if unset or scheduled in the future.
    const publishedAt =
      !r.published_at || new Date(r.published_at).getTime() > now
        ? new Date().toISOString()
        : r.published_at;
    const bodyHtml = await markdownToSafeHtml(r.body_md ?? "");
    const { error } = await db
      .from("posts")
      .update({
        status: "published",
        published_at: publishedAt,
        body_html: bodyHtml,
      })
      .eq("id", r.id);
    if (error) {
      console.error(`[bulk publish] post ${r.id} failed:`, error.message);
      failed.push(r.id);
      continue;
    }
    affected++;
    if (!wasLive) transitioned.push(r.id);
  }

  // Publishing a SINGLE post behaves like the editor's Publish — newsletter-aware,
  // gated only by the master auto_newsletter_on_publish (one post isn't "in bulk").
  // Publishing MULTIPLE additionally requires bulk_publish_sends_newsletter. Either
  // way, maybeAutoSendNewsletter still enforces the master toggle, author inclusion,
  // and the no-resend guard.
  const newsletterAllowed =
    rows.length === 1 || settings.bulk_publish_sends_newsletter;
  if (newsletterAllowed) {
    for (const id of transitioned) {
      await maybeAutoSendNewsletter({
        postId: id,
        liveTransition: true,
        isAdmin: me.isAdmin,
        settings,
      });
    }
  }

  // Refresh the published feeds + each published post page.
  revalidatePostsShallow(targetSlugs);

  // Surface per-row failures (some posts may not have published) rather than
  // reporting a silent partial success.
  return NextResponse.json({ ok: true, affected, failed });
}
