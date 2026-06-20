import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLike } from "@/lib/sql";
import { nowISO } from "@/lib/published";

export type CategoryRef = { name: string; slug: string };
export type TagRef = { name: string; slug: string };

export type PostListed = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  category: CategoryRef | null;
};

export type PostFull = PostListed & {
  body_html: string;
  cover_image: string | null;
  cover_alt: string | null;
  series_id: string | null;
  series_order: number | null;
  author_id: string | null;
  author: { display_name: string | null; full_name: string | null } | null;
  tags: TagRef[];
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  noindex: boolean;
};

export const LIST_COLUMNS =
  "id, title, slug, excerpt, published_at, reading_minutes, category:categories(name, slug)";

// One page of published posts, newest first. Used for the initial server render
// (no cursor) and the infinite-scroll API. Keyset/cursor pagination — NOT offset:
// a post published between page loads can't shift the window and skip/duplicate a
// row the way offset paging does. `id` breaks `published_at` ties so the
// (published_at DESC, id DESC) order is a deterministic total order. Returns one
// extra-fetched `hasMore` flag so the client needn't assume a page size.
export async function getPostsPage(opts: {
  limit: number;
  categoryId?: string | null;
  cursor?: { publishedAt: string; id: string } | null;
}): Promise<{ posts: PostListed[]; hasMore: boolean }> {
  // Cookie-less (published-only) so the home/category feeds can be ISR-cached.
  const supabase = createPublicClient();
  let query = supabase
    .from("posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .lte("published_at", nowISO());
  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.cursor) {
    // Rows strictly "after" the cursor in (published_at DESC, id DESC) order:
    // published_at < cursor, OR same published_at with a smaller id.
    const { publishedAt, id } = opts.cursor;
    query = query.or(
      `published_at.lt.${publishedAt},and(published_at.eq.${publishedAt},id.lt.${id})`,
    );
  }
  // Fetch one extra row so `hasMore` doesn't depend on a fixed page size.
  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);

  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > opts.limit;
  return { posts: hasMore ? rows.slice(0, opts.limit) : rows, hasMore };
}

export async function getRecentPosts(limit = 20): Promise<PostListed[]> {
  // Cookie-free public client (published-only read) — keeps callers cache-safe.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// Full-text search over published posts using the `search_tsv` column (0009).
// `websearch` query syntax supports quoted phrases and OR/-, like a search box.
export async function searchPosts(
  query: string,
  limit = 20,
): Promise<PostListed[]> {
  const q = query.trim();
  if (!q) return [];
  // Cookie-free public client (published-only read) — keeps callers cache-safe.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .lte("published_at", nowISO())
    .textSearch("search_tsv", q, { type: "websearch", config: "english" })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function getTagsForPostId(postId: string): Promise<TagRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("post_tags")
    .select("tag:tags(name, slug)")
    .eq("post_id", postId);

  const rows = data ?? [];
  const tags: TagRef[] = [];
  for (const r of rows) {
    const t = Array.isArray(r.tag) ? r.tag[0] : r.tag;
    if (t) tags.push(t);
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPostBySlug(slug: string): Promise<PostFull | null> {
  // Cookie-less (published-only query) so the post page can be cached — reading
  // cookies would force it dynamic. RLS still limits to published rows.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `${LIST_COLUMNS}, body_html, cover_image, cover_alt, series_id, series_order, author_id, updated_at, seo_title, seo_description, canonical_url, og_image, noindex`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", nowISO())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const raw = data;

  // Byline name (plain query — avoids PostgREST embed quirks) and tags run
  // concurrently; both only need the post row we already have.
  const [author, tags] = await Promise.all([
    raw.author_id
      ? supabase
          .from("profiles")
          .select("display_name, full_name")
          .eq("id", raw.author_id)
          .maybeSingle()
          .then(({ data: a }) => a ?? null)
      : Promise.resolve(null),
    getTagsForPostId(raw.id),
  ]);

  return { ...raw, author, tags };
}

// Public author page: the author's published (live) posts, newest first.
// Looks the profile up by display_name (case-insensitive; usernames are unique).
export type AuthorSocials = {
  website: string | null;
  x: string | null;
  github: string | null;
  bluesky: string | null;
  mastodon: string | null;
  linkedin: string | null;
};

export async function getAuthorPage(username: string): Promise<{
  displayName: string;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  socials: AuthorSocials;
  posts: PostListed[];
} | null> {
  const supabase = await createClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, full_name, avatar_url, bio, website_url, x_url, github_url, bluesky_url, mastodon_url, linkedin_url",
    )
    .ilike("display_name", escapeLike(username))
    .maybeSingle();
  const p = prof;
  // Only authors/admins get a public author page — plain readers (commenters)
  // have profiles too, but shouldn't surface a landing page with 0 posts.
  if (!p || (p.role !== "author" && p.role !== "admin")) return null;

  const { data } = await supabase
    .from("posts")
    .select(LIST_COLUMNS)
    .eq("author_id", p.id)
    .eq("status", "published")
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false });

  return {
    displayName: p.display_name ?? username,
    fullName: p.full_name ?? null,
    avatarUrl: p.avatar_url ?? null,
    bio: p.bio ?? null,
    socials: {
      website: p.website_url ?? null,
      x: p.x_url ?? null,
      github: p.github_url ?? null,
      bluesky: p.bluesky_url ?? null,
      mastodon: p.mastodon_url ?? null,
      linkedin: p.linkedin_url ?? null,
    },
    posts: data ?? [],
  };
}

// Related posts: rank other published posts by how many tags they share with
// this one; if that yields fewer than `limit`, top up with recent posts from
// the same category. Excludes the current post and any duplicates.
export async function getRelatedPosts(
  postId: string,
  limit = 4,
): Promise<PostListed[]> {
  // Cookie-less (published-only) so the post page stays cacheable.
  const supabase = createPublicClient();
  const collected: PostListed[] = [];
  const seen = new Set<string>([postId]);

  // This post's category (for the fallback) and tag ids.
  const { data: cur } = await supabase
    .from("posts")
    .select("category_id")
    .eq("id", postId)
    .maybeSingle();
  const categoryId = cur?.category_id ?? null;

  const { data: ownTags } = await supabase
    .from("post_tags")
    .select("tag_id")
    .eq("post_id", postId);
  const tagIds = (ownTags ?? []).map((t) => t.tag_id);

  // 1. Tag overlap.
  if (tagIds.length > 0) {
    const { data: shared } = await supabase
      .from("post_tags")
      .select("post_id")
      .in("tag_id", tagIds)
      .neq("post_id", postId);
    const counts = new Map<string, number>();
    for (const r of shared ?? []) {
      counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
    }
    // Cap to the strongest overlaps so the follow-up `.in()` stays bounded
    // (avoids a huge id list / over-long URL on popular tags). We only need a
    // few results, so the top 100 candidates are far more than enough. See H3.
    const candidateIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([id]) => id);
    if (candidateIds.length > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select(LIST_COLUMNS)
        .in("id", candidateIds)
        .eq("status", "published")
        .lte("published_at", nowISO());
      const rows = posts ?? [];
      rows.sort((a, b) => {
        const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
        if (diff !== 0) return diff;
        return (b.published_at ?? "").localeCompare(a.published_at ?? "");
      });
      for (const p of rows) {
        if (collected.length >= limit) break;
        if (!seen.has(p.id)) {
          collected.push(p);
          seen.add(p.id);
        }
      }
    }
  }

  // 2. Fall back to same-category recent posts.
  if (collected.length < limit && categoryId) {
    const catPosts = await getPostsByCategoryId(categoryId, limit + 5);
    for (const p of catPosts) {
      if (collected.length >= limit) break;
      if (!seen.has(p.id)) {
        collected.push(p);
        seen.add(p.id);
      }
    }
  }

  return collected;
}

export async function getCategories(): Promise<CategoryRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name, slug")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

// Only categories that have at least one published (and live) post.
export async function getActiveCategories(): Promise<CategoryRef[]> {
  // DB-side: categories with >=1 live post, sorted, via RPC — avoids scanning
  // every published post in JS (which silently capped at 1000 rows). See 0042.
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("active_categories");
  if (error) throw error;
  return ((data ?? []) as { name: string; slug: string }[]).map((c) => ({
    name: c.name,
    slug: c.slug,
  }));
}

export async function getCategoryBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getPostsByCategoryId(
  categoryId: string,
  limit = 50,
): Promise<PostListed[]> {
  // Cookie-free public client: this is reachable from the force-static post page
  // via getRelatedPosts' category fallback, so it must NOT read cookies (would
  // break ISR). Published-only + RLS-anon → identical rows. See REFACTOR-REVIEW C1.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .eq("category_id", categoryId)
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ---- Tags (public) ----

export async function getTagBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getPostsByTagId(tagId: string): Promise<PostListed[]> {
  // Single inner-join query (filter posts by an embedded post_tags row) instead
  // of fetching all tag links then a giant `.in(ids)` — the old shape did two
  // unbounded selects and could blow past the 1000-row cap / URL length. See H3.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(`${LIST_COLUMNS}, post_tags!inner(tag_id)`)
    .eq("post_tags.tag_id", tagId)
    .eq("status", "published")
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Tags that have at least one published (live) post — for sitemap / listings.
export async function getActiveTags(): Promise<TagRef[]> {
  // DB-side: tags with >=1 live post, sorted, via RPC (cookie-free public client)
  // — replaces a two-step whole-table scan that capped at 1000 rows. See 0042.
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("active_tags");
  if (error) throw error;
  return ((data ?? []) as { name: string; slug: string }[]).map((t) => ({
    name: t.name,
    slug: t.slug,
  }));
}

// ---- Admin-only reads (rely on the admin's session + RLS to see drafts) ----

export type CategoryOption = { id: string; name: string; slug: string };

export type AdminPostRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
  category: CategoryRef | null;
};

export type AdminPostFull = {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  author_id: string | null;
  excerpt: string | null;
  body_md: string;
  cover_image: string | null;
  cover_alt: string | null;
  status: "draft" | "published";
  published_at: string | null;
  newsletter_sent_at: string | null;
  series_id: string | null;
  series_order: number | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  noindex: boolean;
};

export type CategoryWithCounts = {
  id: string;
  name: string;
  slug: string;
  total: number;
  published: number;
};

export async function getCategoriesWithCounts(): Promise<CategoryWithCounts[]> {
  // DB-side counts (admin/service-role: exposes draft totals) via RPC — replaces
  // a whole-`posts`-table scan counted in JS that capped at 1000 rows. See 0042.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("category_counts");
  if (error) throw error;
  return (data ?? []) as CategoryWithCounts[];
}

export type TagWithCounts = {
  id: string;
  name: string;
  slug: string;
  total: number;
  published: number;
};

// Admin: every tag with its post counts (total + published). Used by the Tags
// manage page so an admin can see usage and delete/prune. Admin-only caller.
export async function getTagsWithCounts(): Promise<TagWithCounts[]> {
  // DB-side counts (admin/service-role: exposes draft totals) via RPC — replaces
  // a three-way whole-table scan counted in JS that capped at 1000 rows. See 0042.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("tag_counts");
  if (error) throw error;
  return (data ?? []) as TagWithCounts[];
}

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

// Admin dashboard list. Pass `authorId` to scope to one author's posts (used so
// authors see only their own; admins call it with no filter to see all).
export async function getAllPostsForAdmin(
  authorId?: string,
): Promise<AdminPostRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select(
      "id, title, slug, status, published_at, updated_at, category:categories(name, slug)",
    );
  if (authorId) query = query.eq("author_id", authorId);
  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPostByIdForAdmin(
  id: string,
): Promise<AdminPostFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, slug, category_id, author_id, excerpt, body_md, cover_image, cover_alt, status, published_at, newsletter_sent_at, series_id, series_order, seo_title, seo_description, canonical_url, og_image, noindex",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: tagLinks } = await supabase
    .from("post_tags")
    .select("tag:tags(name)")
    .eq("post_id", id);
  const tags: string[] = [];
  for (const r of tagLinks ?? []) {
    const t = Array.isArray(r.tag) ? r.tag[0] : r.tag;
    if (t) tags.push(t.name);
  }

  return { ...data, tags };
}
