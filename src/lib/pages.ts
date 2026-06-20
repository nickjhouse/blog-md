import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { slugify } from "@/lib/slug";
import { escapeLike } from "@/lib/sql";

// Top-level route names a CMS page slug must not collide with (these static
// routes take Next.js precedence, so such a page would be unreachable). Plus a
// few reserved metadata routes. Enforced when creating/renaming a page.
export const RESERVED_SLUGS = new Set([
  "account",
  "admin",
  "api",
  "auth",
  "author",
  "bookmarks",
  "brand-logo",
  "category",
  "contact",
  // Browser/crawler auto-probes for single-segment asset paths — short-circuit
  // so they 404 instantly instead of hitting the DB via getPageBySlug.
  "favicon.ico",
  "apple-touch-icon.png",
  "apple-touch-icon-precomposed.png",
  "feed.xml",
  "login",
  "media",
  "newsletter",
  "post",
  "privacy",
  "reset",
  "robots.txt",
  "search",
  "series",
  "signup",
  "sitemap.xml",
  "tag",
  "verify",
  "welcome",
]);

export type Page = {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  bodyHtml: string;
  enabled: boolean;
  showInFooter: boolean;
  seoDescription: string | null;
  updatedAt: string;
};

export type PageListItem = {
  id: string;
  slug: string;
  title: string;
  enabled: boolean;
  showInFooter: boolean;
  updatedAt: string;
};

type RawPage = {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  body_html: string;
  enabled: boolean;
  show_in_footer: boolean;
  seo_description: string | null;
  updated_at: string;
};

function mapPage(r: RawPage): Page {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    bodyMd: r.body_md,
    bodyHtml: r.body_html,
    enabled: r.enabled,
    showInFooter: r.show_in_footer,
    seoDescription: r.seo_description,
    updatedAt: r.updated_at,
  };
}

// Public render: an ENABLED page by slug. Cookie-less public client so the
// /[slug] route can be ISR-cached (a cookie read would force it dynamic). RLS
// ("enabled or admin") + the anon client means only enabled pages are returned;
// disabled-page preview lives in the admin preview route instead. Returns null
// (→ 404) for missing or disabled pages.
export async function getPageBySlug(slug: string): Promise<Page | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("pages")
    .select(
      "id, slug, title, body_md, body_html, enabled, show_in_footer, seo_description, updated_at",
    )
    .ilike("slug", escapeLike(slug))
    .maybeSingle();
  return data ? mapPage(data) : null;
}

// Admin list (all pages, newest-updated first) — service-role read.
export async function listPages(): Promise<PageListItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select("id, slug, title, enabled, show_in_footer, updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    enabled: r.enabled,
    showInFooter: r.show_in_footer,
    updatedAt: r.updated_at,
  }));
}

// Admin editor: a single page by id — service-role read (sees disabled too).
export async function getPageForAdmin(id: string): Promise<Page | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select(
      "id, slug, title, body_md, body_html, enabled, show_in_footer, seo_description, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  return data ? mapPage(data) : null;
}

// Enabled pages for the sitemap (slug + lastmod). Anon-readable via RLS.
export async function getEnabledPagesForSitemap(): Promise<
  { slug: string; updatedAt: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("slug, updated_at")
    .eq("enabled", true);
  return ((data ?? []) as { slug: string; updated_at: string }[]).map((r) => ({
    slug: r.slug,
    updatedAt: r.updated_at,
  }));
}

// Enabled + footer-flagged pages for the site footer nav.
export async function getFooterPages(): Promise<
  { slug: string; title: string }[]
> {
  // Cookie-less: read in the root layout, which must not read cookies or every
  // page is forced dynamic (blocks caching). Only public, enabled pages.
  // Fail-safe (return []) so a build-time prerender of the layout shell (e.g.
  // /_not-found) can't crash if Supabase is briefly unreachable.
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("pages")
      .select("slug, title")
      .eq("enabled", true)
      .eq("show_in_footer", true)
      .order("title");
    return ((data ?? []) as { slug: string; title: string }[]).map((r) => ({
      slug: r.slug,
      title: r.title,
    }));
  } catch {
    return [];
  }
}

export type PageInput = {
  slug: string;
  title: string;
  body_md: string;
  enabled: boolean;
  show_in_footer: boolean;
  seo_description: string | null;
};

export type PageParseResult =
  | { ok: true; value: PageInput }
  | { ok: false; error: string };

// Validate/normalize create+update input. Slug is normalized via slugify and
// checked against the reserved list; title required; body optional.
export function parsePageInput(raw: unknown): PageParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request body" };
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title || title.length > 200) {
    return { ok: false, error: "Title is required (max 200 chars)." };
  }
  const rawSlug = typeof o.slug === "string" && o.slug.trim() ? o.slug : title;
  const slug = slugify(rawSlug);
  if (!slug) return { ok: false, error: "A valid slug is required." };
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: `"${slug}" is a reserved path — choose another slug.` };
  }
  const body_md = typeof o.body_md === "string" ? o.body_md : "";
  const seo =
    typeof o.seo_description === "string" && o.seo_description.trim()
      ? o.seo_description.trim().slice(0, 300)
      : null;
  return {
    ok: true,
    value: {
      slug,
      title,
      body_md,
      enabled: o.enabled === true,
      show_in_footer: o.show_in_footer === true,
      seo_description: seo,
    },
  };
}
