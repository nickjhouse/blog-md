import { revalidatePath } from "next/cache";
import { getPostBySlug } from "@/lib/posts";
import { createAdminClient } from "@/lib/supabase/admin";

// On-demand revalidation of the cached public pages. These run inside the
// admin mutation routes so a publish/edit/delete updates the time-based ISR
// pages immediately instead of waiting out their window (post 1h, feeds 60s).

// Revalidate the home feed + the given post page(s). Skips empties/dupes.
function revalidateBase(slugs: readonly string[]): void {
  revalidatePath("/");
  for (const s of new Set(slugs.filter(Boolean))) {
    revalidatePath(`/post/${s}`);
  }
}

/**
 * Full revalidation for a single post create/update: home, the post page and —
 * when the post is currently published+live — its category and tag feed pages
 * (relation slugs read from the published view; null for drafts, so those pages
 * are left to their own 60s window). `formerSlug` covers a slug rename so the
 * old URL is invalidated too. Best-effort — never throws into the caller.
 */
export async function revalidatePost(
  slug: string,
  formerSlug?: string | null,
): Promise<void> {
  try {
    revalidateBase([slug, formerSlug ?? ""]);
    const pub = await getPostBySlug(slug);
    if (pub?.category?.slug) revalidatePath(`/category/${pub.category.slug}`);
    for (const t of pub?.tags ?? []) revalidatePath(`/tag/${t.slug}`);
  } catch (err) {
    console.error("[revalidate] post failed", err);
  }
}

/**
 * A post's category slug + tag slugs, read via the admin client so it works
 * REGARDLESS of publication status. `getPostBySlug` is published-only and would
 * return nothing for a just-unpublished post, so it can't be used to invalidate
 * the listings an unpublished/draft post is leaving. Best-effort (returns empty
 * on error). Capture this BEFORE a mutation to get the pre-change relations.
 */
export async function getPostRelationSlugs(
  postId: string,
): Promise<{ category: string | null; tags: string[] }> {
  try {
    const db = createAdminClient();
    const [postRes, tagRes] = await Promise.all([
      db.from("posts").select("category:categories(slug)").eq("id", postId).maybeSingle(),
      db.from("post_tags").select("tag:tags(slug)").eq("post_id", postId),
    ]);
    const catEmbed = postRes.data?.category ?? null;
    const cat = Array.isArray(catEmbed) ? catEmbed[0] : catEmbed;
    const tags: string[] = [];
    for (const r of tagRes.data ?? []) {
      const t = Array.isArray(r.tag) ? r.tag[0] : r.tag;
      if (t?.slug) tags.push(t.slug);
    }
    return { category: cat?.slug ?? null, tags };
  } catch (err) {
    console.error("[revalidate] getPostRelationSlugs failed", err);
    return { category: null, tags: [] };
  }
}

/**
 * Full revalidation for a post UPDATE. Revalidates home + the post page(s) + the
 * UNION of the post's OLD and NEW category/tag listing pages. The union is what
 * makes unpublish, category change, and tag change correct: the listings the
 * post is *leaving* (old relations) are refreshed too, not just the ones it
 * joins. Pass `before` captured via getPostRelationSlugs() BEFORE the mutation;
 * this re-reads the current (after) relations. Best-effort.
 */
export async function revalidatePostUpdate(opts: {
  slug: string;
  formerSlug?: string | null;
  postId: string;
  before: { category: string | null; tags: string[] };
}): Promise<void> {
  try {
    revalidateBase([opts.slug, opts.formerSlug ?? ""]);
    const after = await getPostRelationSlugs(opts.postId);
    const cats = new Set<string>();
    if (opts.before.category) cats.add(opts.before.category);
    if (after.category) cats.add(after.category);
    for (const c of cats) revalidatePath(`/category/${c}`);
    const tags = new Set<string>([...opts.before.tags, ...after.tags]);
    for (const t of tags) revalidatePath(`/tag/${t}`);
  } catch (err) {
    console.error("[revalidate] post update failed", err);
  }
}

/**
 * Lightweight revalidation for delete / bulk actions: home + each affected post
 * page. Category/tag feed pages fall back to their 60s window (acceptable; not
 * worth a per-post relation lookup across a bulk set). Best-effort.
 */
export function revalidatePostsShallow(slugs: readonly string[]): void {
  try {
    revalidateBase(slugs);
  } catch (err) {
    console.error("[revalidate] shallow failed", err);
  }
}

/**
 * Revalidate a static CMS page: the page's own URL (`/<slug>`, + the former slug
 * on a rename) AND the shared layout (footer links / enabled state are baked
 * into every cached page). The page-specific path call is required because a
 * layout-level revalidation alone isn't reliable for on-demand dynamic
 * `/[slug]` instances. Best-effort.
 */
export function revalidatePage(slug: string, formerSlug?: string | null): void {
  try {
    for (const s of new Set([slug, formerSlug ?? ""].filter(Boolean))) {
      revalidatePath(`/${s}`);
    }
    revalidateLayout();
  } catch (err) {
    console.error("[revalidate] page failed", err);
  }
}

/**
 * Revalidate after a tag delete/prune: home + each removed tag's listing page
 * (now empty → 404) + any posts that displayed the tag (chip removed by the FK
 * cascade). Pass affected post slugs for a single in-use delete; prune of unused
 * tags can omit them. Best-effort.
 */
export function revalidateTagDeletion(
  slugs: readonly string[],
  postSlugs: readonly string[] = [],
): void {
  try {
    revalidatePath("/");
    for (const s of new Set(slugs.filter(Boolean))) {
      revalidatePath(`/tag/${s}`);
    }
    for (const p of new Set(postSlugs.filter(Boolean))) {
      revalidatePath(`/post/${p}`);
    }
  } catch (err) {
    console.error("[revalidate] tag deletion failed", err);
  }
}

/**
 * Revalidate after a category delete: home + the category's listing page (now a
 * 404) + each member post page. The FK nulls members' category_id, so each
 * member post page otherwise keeps showing a category link to the now-deleted
 * (404) category for up to its 1h window. Pass member post slugs captured BEFORE
 * the delete. Best-effort.
 */
export function revalidateCategoryDeletion(
  slug: string,
  memberPostSlugs: readonly string[],
): void {
  try {
    revalidatePath("/");
    if (slug) revalidatePath(`/category/${slug}`);
    for (const p of new Set(memberPostSlugs.filter(Boolean))) {
      revalidatePath(`/post/${p}`);
    }
  } catch (err) {
    console.error("[revalidate] category deletion failed", err);
  }
}

/**
 * Revalidate the public pages a series rename/delete affects: home + the series
 * listing + the series' own page(s) (old ∪ new slug) + each member post page
 * (its SeriesNav shows the series title/links). Pass member post slugs captured
 * around the mutation. Best-effort.
 */
export function revalidateSeries(opts: {
  slugs: readonly string[];
  memberPostSlugs: readonly string[];
}): void {
  try {
    revalidatePath("/");
    revalidatePath("/series");
    for (const s of new Set(opts.slugs.filter(Boolean))) {
      revalidatePath(`/series/${s}`);
    }
    for (const p of new Set(opts.memberPostSlugs.filter(Boolean))) {
      revalidatePath(`/post/${p}`);
    }
  } catch (err) {
    console.error("[revalidate] series failed", err);
  }
}

/**
 * Revalidate every cached public page by invalidating the shared root layout.
 * Use for changes to the chrome baked into all pages — static pages (content +
 * footer links), site identity, theme, brand mark, contact toggle, newsletter
 * prompt. Coarse but lazy: pages re-render one at a time on their next visit, no
 * thundering herd. Settings/page edits are rare, so the breadth is fine.
 * Best-effort — never throws into the caller.
 */
export function revalidateLayout(): void {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    console.error("[revalidate] layout failed", err);
  }
}
