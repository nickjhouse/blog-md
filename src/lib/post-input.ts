// Shared validation for the create/update post routes.
export type PostInput = {
  title: string;
  slug: string;
  category_id: string | null;
  excerpt: string | null;
  body_md: string;
  cover_image: string | null;
  cover_alt: string | null;
  status: "draft" | "published";
  published_at: string | null; // ISO; for scheduling. null = use default
  tags: string[]; // tag names
  series_id: string | null;
  series_order: number | null;
  author_id: string | null; // admin-only reassignment; ignored for authors
  // Per-post SEO overrides (all optional; fall back to defaults when null/false).
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  noindex: boolean;
};

export type ParseResult =
  | { ok: true; value: PostInput }
  | { ok: false; error: string };

// Cover + OG image URLs may be an absolute http(s) URL (a Supabase Storage URL
// or an external image) or a relative/same-origin path (e.g. `/media/...`).
// Reject any other scheme (javascript:, data:, file:, …); empty → null.
// `ok:false` means a scheme was present that isn't http(s).
export function normalizeImageUrl(v: unknown): {
  ok: boolean;
  value: string | null;
} {
  if (typeof v !== "string") return { ok: true, value: null };
  const t = v.trim();
  if (!t) return { ok: true, value: null };
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^https?:\/\//i.test(t)) {
    return { ok: false, value: null };
  }
  return { ok: true, value: t };
}

export function parsePostInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request body" };
  }
  const o = raw as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title.trim() : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  const body_md = typeof o.body_md === "string" ? o.body_md : "";
  const status =
    o.status === "published" ? "published" : o.status === "draft" ? "draft" : null;

  if (!title) return { ok: false, error: "Title is required" };
  if (!slug) return { ok: false, error: "Slug is required" };
  if (!status) return { ok: false, error: "Status must be draft or published" };

  const tags = Array.isArray(o.tags)
    ? [
        ...new Set(
          o.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ].slice(0, 20)
    : [];

  // Canonical URL, when provided, must be an absolute http(s) URL.
  let canonical_url: string | null = null;
  if (typeof o.canonical_url === "string" && o.canonical_url.trim()) {
    const c = o.canonical_url.trim();
    if (!/^https?:\/\//i.test(c)) {
      return {
        ok: false,
        error: "Canonical URL must start with http:// or https://",
      };
    }
    canonical_url = c;
  }

  // Cover + OG images: reject a non-http(s) scheme (relative paths are fine).
  const cover = normalizeImageUrl(o.cover_image);
  if (!cover.ok) {
    return {
      ok: false,
      error: "Cover image must be an http(s) URL or a relative path",
    };
  }
  const og = normalizeImageUrl(o.og_image);
  if (!og.ok) {
    return {
      ok: false,
      error: "OG image must be an http(s) URL or a relative path",
    };
  }

  const trimOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  return {
    ok: true,
    value: {
      title,
      slug,
      body_md,
      status,
      tags,
      category_id:
        typeof o.category_id === "string" && o.category_id ? o.category_id : null,
      excerpt:
        typeof o.excerpt === "string" && o.excerpt.trim()
          ? o.excerpt.trim()
          : null,
      cover_image: cover.value,
      cover_alt:
        typeof o.cover_alt === "string" && o.cover_alt.trim()
          ? o.cover_alt.trim()
          : null,
      published_at:
        typeof o.published_at === "string" && o.published_at
          ? o.published_at
          : null,
      series_id:
        typeof o.series_id === "string" && o.series_id ? o.series_id : null,
      series_order:
        typeof o.series_order === "number" && Number.isFinite(o.series_order)
          ? Math.trunc(o.series_order)
          : null,
      author_id:
        typeof o.author_id === "string" && o.author_id ? o.author_id : null,
      seo_title: trimOrNull(o.seo_title),
      seo_description: trimOrNull(o.seo_description),
      canonical_url,
      og_image: og.value,
      noindex: o.noindex === true,
    },
  };
}
