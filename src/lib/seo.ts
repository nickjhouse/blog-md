import { createPublicClient } from "@/lib/supabase/public";
import { escapeLike } from "@/lib/sql";
import { nowISO } from "@/lib/published";

// Site identity is centralized in site.config.ts. Re-exported here so existing
// `import { SITE_NAME, SITE_URL } from "@/lib/seo"` callers keep working.
export { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site.config";

export type SitemapPost = { slug: string; updated_at: string };

export async function getPublishedPostsForSitemap(): Promise<SitemapPost[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select("slug, updated_at")
    .eq("status", "published")
    .eq("noindex", false)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Only categories that have a published (live) post — matches the public nav.
export async function getCategorySlugsForSitemap(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select("category:categories(slug)")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());
  if (error) throw error;

  const set = new Set<string>();
  for (const r of data ?? []) {
    const c = Array.isArray(r.category) ? r.category[0] : r.category;
    if (c) set.add(c.slug);
  }
  return [...set];
}

// Tag slugs that have at least one live post — for the sitemap.
export async function getTagSlugsForSitemap(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());
  const ids = (posts ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: links } = await supabase
    .from("post_tags")
    .select("tag:tags(slug)")
    .in("post_id", ids);
  const set = new Set<string>();
  for (const r of links ?? []) {
    const t = Array.isArray(r.tag) ? r.tag[0] : r.tag;
    if (t) set.add(t.slug);
  }
  return [...set];
}

export type FeedPost = {
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  category: string | null;
};

// Posts for the RSS/Atom feed — newest first, capped. Mirrors the public
// visibility rules (published + not future-dated).
export async function getPostsForFeed(limit = 30): Promise<FeedPost[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select("title, slug, excerpt, published_at, category:categories(name)")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return mapFeedRows(data ?? []);
}

// Shared select + mapping for feed rows (global + scoped feeds).
const FEED_SELECT = "title, slug, excerpt, published_at, category:categories(name)";

type FeedRow = {
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  category: { name: string } | { name: string }[] | null;
};

function mapFeedRows(rows: FeedRow[]): FeedPost[] {
  return rows.map((r) => {
    const c = Array.isArray(r.category) ? r.category[0] : r.category;
    return {
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      published_at: r.published_at,
      category: c?.name ?? null,
    };
  });
}

// A scoped feed: a human-readable label for the channel title + its posts.
// null = the scope (category/tag/author) doesn't exist → the route should 404.
export type ScopedFeed = { label: string; posts: FeedPost[] };

export async function getCategoryFeed(
  slug: string,
  limit = 30,
): Promise<ScopedFeed | null> {
  const supabase = createPublicClient();
  const { data: cat } = await supabase
    .from("categories")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!cat) return null;
  const { data } = await supabase
    .from("posts")
    .select(FEED_SELECT)
    .eq("status", "published")
    .eq("category_id", cat.id)
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false })
    .limit(limit);
  return { label: cat.name, posts: mapFeedRows(data ?? []) };
}

export async function getTagFeed(
  slug: string,
  limit = 30,
): Promise<ScopedFeed | null> {
  const supabase = createPublicClient();
  const { data: tag } = await supabase
    .from("tags")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!tag) return null;
  const { data: links } = await supabase
    .from("post_tags")
    .select("post_id")
    .eq("tag_id", tag.id);
  const ids = (links ?? []).map((l) => l.post_id);
  if (ids.length === 0) return { label: `#${tag.name}`, posts: [] };
  const { data } = await supabase
    .from("posts")
    .select(FEED_SELECT)
    .in("id", ids)
    .eq("status", "published")
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false })
    .limit(limit);
  return { label: `#${tag.name}`, posts: mapFeedRows(data ?? []) };
}

export async function getAuthorFeed(
  username: string,
  limit = 30,
): Promise<ScopedFeed | null> {
  const supabase = createPublicClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, role")
    .ilike("display_name", escapeLike(username))
    .maybeSingle();
  // Only authors/admins have a public author surface (matches the author page).
  if (!prof || (prof.role !== "author" && prof.role !== "admin")) return null;
  const { data } = await supabase
    .from("posts")
    .select(FEED_SELECT)
    .eq("status", "published")
    .eq("author_id", prof.id)
    .lte("published_at", nowISO())
    .order("published_at", { ascending: false })
    .limit(limit);
  const label = prof.full_name?.trim() || prof.display_name || username;
  return { label, posts: mapFeedRows(data ?? []) };
}

// Series slugs that have at least one live post — for the sitemap.
export async function getSeriesSlugsForSitemap(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("series_id")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());
  const ids = new Set(
    (posts ?? [])
      .map((p) => p.series_id)
      .filter((id): id is string => !!id),
  );
  if (ids.size === 0) return [];

  const { data: series } = await supabase
    .from("series")
    .select("slug")
    .in("id", [...ids]);
  return (series ?? []).map((s) => s.slug);
}

// Author usernames (display_name) with at least one live post — for the sitemap.
export async function getAuthorUsernamesForSitemap(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("author_id")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());
  const ids = new Set(
    (posts ?? [])
      .map((p) => p.author_id)
      .filter((id): id is string => !!id),
  );
  if (ids.size === 0) return [];

  const { data: authors } = await supabase
    .from("profiles")
    .select("display_name")
    .in("id", [...ids])
    .in("role", ["author", "admin"]);
  return (authors ?? [])
    .map((a) => a.display_name)
    .filter((n): n is string => !!n);
}

export type PostOgData = { title: string; category: string | null };

// Lightweight fetch for the OG-image route: just the title + category name.
export async function getPostOgData(slug: string): Promise<PostOgData | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("posts")
    .select("title, category:categories(name)")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;

  const row = data;
  const category = Array.isArray(row.category)
    ? (row.category[0]?.name ?? null)
    : (row.category?.name ?? null);
  return { title: row.title, category };
}
