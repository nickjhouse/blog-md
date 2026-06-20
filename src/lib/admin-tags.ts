import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { slugify } from "@/lib/slug";

type Admin = SupabaseClient<Database>;

/**
 * Delete any of the given tags that no longer have ANY post_tags link — i.e.
 * tags orphaned by an edit/delete. Tags are auto-created on use and would
 * otherwise accumulate as unusable empty-listing rows. Best-effort: pass the
 * tag_ids that were just unlinked; this checks each for remaining links first.
 */
export async function pruneOrphanTags(
  admin: Admin,
  tagIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(tagIds)].filter(Boolean);
  if (unique.length === 0) return;
  const { data } = await admin
    .from("post_tags")
    .select("tag_id")
    .in("tag_id", unique);
  const stillUsed = new Set(
    ((data ?? []) as { tag_id: string }[]).map((r) => r.tag_id),
  );
  const orphans = unique.filter((id) => !stillUsed.has(id));
  if (orphans.length > 0) {
    await admin.from("tags").delete().in("id", orphans);
  }
}

// Replace a post's tags with the given names. Upserts tags by slug, then resets
// the post_tags links. Runs with the service-role admin client.
export async function syncPostTags(
  admin: Admin,
  postId: string,
  names: string[],
): Promise<void> {
  // Capture the post's current tag links first, so we can prune any tag this
  // edit removes that no other post still uses.
  const { data: oldLinks } = await admin
    .from("post_tags")
    .select("tag_id")
    .eq("post_id", postId);
  const oldTagIds = ((oldLinks ?? []) as { tag_id: string }[]).map(
    (l) => l.tag_id,
  );

  const cleaned = [
    ...new Set(names.map((n) => n.trim()).filter(Boolean)),
  ];

  const tagIds: string[] = [];
  for (const name of cleaned) {
    const slug = slugify(name);
    if (!slug) continue;

    const { data: existing } = await admin
      .from("tags")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let id = existing?.id;
    if (!id) {
      const { data: created, error } = await admin
        .from("tags")
        .insert({ name, slug })
        .select("id")
        .single();
      if (error) {
        // Unique-conflict race — re-fetch.
        const { data: refetched } = await admin
          .from("tags")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        id = refetched?.id;
      } else {
        id = created.id;
      }
    }
    if (id) tagIds.push(id);
  }

  await admin.from("post_tags").delete().eq("post_id", postId);
  if (tagIds.length > 0) {
    await admin
      .from("post_tags")
      .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
  }

  // Prune tags this edit removed from the post (kept ones obviously still link).
  const removed = oldTagIds.filter((id) => !tagIds.includes(id));
  await pruneOrphanTags(admin, removed);
}
