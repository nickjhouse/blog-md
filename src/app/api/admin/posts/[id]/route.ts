import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, assertPostOwnership } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePostInput } from "@/lib/post-input";
import { buildPostRow, captureRevisionFromInput } from "@/lib/post-write";
import { syncPostTags, pruneOrphanTags } from "@/lib/admin-tags";
import { getSettings } from "@/lib/settings";
import { maybeAutoSendNewsletter } from "@/lib/newsletter";
import {
  getPostRelationSlugs,
  revalidatePostUpdate,
  revalidatePostsShallow,
} from "@/lib/revalidate";
import { mapPgError, serverError } from "@/lib/api-error";
import { isLive } from "@/lib/published";

type Ctx = { params: Promise<{ id: string }> };

// Update a post. Authors may update only their own; admins any. Preserves the
// original published_at when already published; sets it on first publish; clears
// it when moved back to draft.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const parsed = parsePostInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  const supabaseAdmin = createAdminClient();
  const { data: existing } = await supabaseAdmin
    .from("posts")
    .select("status, published_at, author_id, slug")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  // Ownership: authors can only edit their own posts.
  const ownership = assertPostOwnership(existing, me);
  if (ownership) return ownership;
  // Capture the post's category/tag slugs BEFORE the edit, so revalidation can
  // refresh the listing pages it's *leaving* (unpublish, category/tag change) —
  // not just the ones it ends up on. (status-agnostic, admin client.)
  const beforeRels = await getPostRelationSlugs(id);
  // Only admins may reassign authorship; authors keep the existing author.
  const authorId = me.isAdmin
    ? (input.author_id ?? existing.author_id)
    : existing.author_id;

  // Scheduling: an explicit published_at (incl. a future one) wins. A CLEARED
  // field means "publish now" (per the editor hint) — so we stamp now instead of
  // falling back to the existing date. This lets you publish a scheduled post
  // early by clearing its date. Normal edits keep the original date because the
  // editor pre-fills the field and sends it back. Draft clears it entirely.
  let publishedAt = existing.published_at;
  if (input.status === "published") {
    publishedAt = input.published_at ?? new Date().toISOString();
  } else {
    publishedAt = null;
  }

  const { data, error } = await supabaseAdmin
    .from("posts")
    .update(
      await buildPostRow(input, { authorId, publishedAt, admin: supabaseAdmin }),
    )
    .eq("id", id)
    .select("id, slug")
    .single();

  if (error) {
    return mapPgError(error, "A post with that slug already exists.");
  }

  await syncPostTags(supabaseAdmin, id, input.tags);

  // Snapshot the just-saved version — best-effort; never blocks the update.
  await captureRevisionFromInput(supabaseAdmin, input, {
    postId: id,
    editedBy: me.userId,
    publishedAt,
  });

  // Auto-send only on the TRANSITION to live (not on edits of an already-live
  // post), and only when the actor is permitted by the settings.
  const nowLive = isLive({ status: input.status, published_at: publishedAt });
  const wasLive = isLive(existing);
  const settings = await getSettings();
  const newsletter = await maybeAutoSendNewsletter({
    postId: id,
    liveTransition: nowLive && !wasLive,
    isAdmin: me.isAdmin,
    settings,
  });

  // Refresh the cached pages now (post + home + the union of old/new category &
  // tag listings); invalidate the old URL too if the slug changed.
  await revalidatePostUpdate({
    slug: data.slug,
    formerSlug: existing.slug,
    postId: id,
    before: beforeRels,
  });

  return NextResponse.json({ post: data, newsletter });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const supabaseAdmin = createAdminClient();
  const { data: existing } = await supabaseAdmin
    .from("posts")
    .select("author_id, slug")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  // Ownership: authors can only delete their own posts.
  const ownership = assertPostOwnership(existing, me);
  if (ownership) return ownership;

  // Capture the post's tag links before delete (the FK cascade removes them) so
  // we can prune any tag left orphaned.
  const { data: tagLinks } = await supabaseAdmin
    .from("post_tags")
    .select("tag_id")
    .eq("post_id", id);
  const tagIds = ((tagLinks ?? []) as { tag_id: string }[]).map((l) => l.tag_id);

  const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);
  if (error) {
    return serverError(error);
  }

  await pruneOrphanTags(supabaseAdmin, tagIds);

  // Drop the deleted post's page (now 404) + home from cache immediately.
  revalidatePostsShallow([existing.slug]);

  return NextResponse.json({ ok: true });
}
