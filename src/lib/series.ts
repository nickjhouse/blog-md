import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIST_COLUMNS, type PostListed } from "@/lib/posts";
import { nowISO } from "@/lib/published";

export type SeriesOption = { id: string; title: string; slug: string };

export type SeriesForPost = {
  id: string;
  title: string;
  slug: string;
  parts: { slug: string; title: string }[]; // ordered, published + live
};

export type SeriesWithCounts = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  total: number;
  published: number;
};

// Order by explicit part number, then publish date (nulls last).
function byPart<T extends { series_order: number | null; published_at: string | null }>(
  a: T,
  b: T,
): number {
  const ao = a.series_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.series_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.published_at ?? "").localeCompare(b.published_at ?? "");
}

// Cheap check: does any published (live) post belong to a series? Used to
// conditionally show the footer "Series" link without a heavier query.
export async function hasPublishedSeries(): Promise<boolean> {
  // Cookie-less: called in the root layout, which must stay cookie-free so pages
  // aren't forced dynamic. Reads only published (public) data. Fail-safe (false)
  // so a build-time prerender of the layout shell can't crash.
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("posts")
      .select("series_id")
      .eq("status", "published")
      .lte("published_at", nowISO())
      .not("series_id", "is", null)
      .limit(1);
    return ((data ?? []) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

// Editor dropdown.
export async function getSeriesOptions(): Promise<SeriesOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("id, title, slug")
    .order("title");
  if (error) throw error;
  return data ?? [];
}

// Nav data for a post in a series: the series + its ordered published parts.
export async function getSeriesForPost(
  seriesId: string,
): Promise<SeriesForPost | null> {
  // Cookie-less (published-only) so the post page stays cacheable.
  const supabase = createPublicClient();
  const { data: sData } = await supabase
    .from("series")
    .select("id, title, slug")
    .eq("id", seriesId)
    .maybeSingle();
  const s = sData;
  if (!s) return null;

  const { data: posts } = await supabase
    .from("posts")
    .select("slug, title, series_order, published_at")
    .eq("series_id", seriesId)
    .eq("status", "published")
    .lte("published_at", nowISO());

  const rows = posts ?? [];
  rows.sort(byPart);
  return {
    id: s.id,
    title: s.title,
    slug: s.slug,
    parts: rows.map((r) => ({ slug: r.slug, title: r.title })),
  };
}

export type SeriesWithParts = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  parts: PostListed[];
};

// /series/[slug] — the series + its ordered, published parts.
export async function getSeriesBySlug(
  slug: string,
): Promise<SeriesWithParts | null> {
  const supabase = await createClient();
  const { data: sData } = await supabase
    .from("series")
    .select("id, title, slug, description")
    .eq("slug", slug)
    .maybeSingle();
  const s = sData;
  if (!s) return null;

  const { data: posts } = await supabase
    .from("posts")
    .select(`${LIST_COLUMNS}, series_order`)
    .eq("series_id", s.id)
    .eq("status", "published")
    .lte("published_at", nowISO());

  const rows = posts ?? [];
  rows.sort(byPart);
  return { ...s, parts: rows };
}

// /series index — series that have at least one published (live) post.
export async function getPublishedSeries(): Promise<SeriesWithCounts[]> {
  // DB-side via RPC (cookie-free public client): series with >=1 live post + the
  // live count. Replaces a whole-`posts` scan counted in JS (1000-row cap). The
  // RPC exposes no draft `total`, so we surface total: 0 (as before). See 0042.
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("published_series");
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      published: number;
    }[]
  ).map((s) => ({ ...s, total: 0 }));
}

// /admin/series — all series with total + published counts. Relies on the
// admin session + RLS to count drafts.
export async function getAllSeriesWithCounts(): Promise<SeriesWithCounts[]> {
  // DB-side counts (admin/service-role: includes draft totals) via RPC — replaces
  // a whole-`posts`-table scan counted in JS that capped at 1000 rows. See 0042.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("series_counts");
  if (error) throw error;
  return (data ?? []) as SeriesWithCounts[];
}
