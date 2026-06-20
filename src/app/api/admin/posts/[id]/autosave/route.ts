import { NextResponse, type NextRequest } from "next/server";
import {
  requireContributor,
  assertPostOwnership,
  parseJson,
} from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { readingMinutes } from "@/lib/content";
import { normalizeImageUrl } from "@/lib/post-input";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Content-only autosave for an existing post. Deliberately narrow: it NEVER
// touches status, published_at, the author, tags, or the newsletter — so an
// autosave can't publish, unpublish, reorder the feed, or fire a broadcast. It
// also doesn't regenerate body_html (drafts aren't public; the manual Save
// rebuilds it on publish), keeping each autosave cheap. Tolerant of partial
// input mid-edit; title (NOT NULL) only changes when non-empty.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const o = await parseJson(req);

  const db = createAdminClient();
  const { data: existing } = await db
    .from("posts")
    .select("author_id, title")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const row = existing as { author_id: string | null; title: string };
  const ownership = assertPostOwnership(row, me);
  if (ownership) return ownership;

  const strOrNull = (v: unknown): string | null => {
    const t = typeof v === "string" ? v.trim() : "";
    return t ? t : null;
  };

  const bodyMd = typeof o.body_md === "string" ? o.body_md : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";

  const seriesId = strOrNull(o.series_id);
  let seriesOrder: number | null = null;
  if (seriesId) {
    const raw = o.series_order;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim() !== ""
          ? Number(raw)
          : NaN;
    seriesOrder = Number.isFinite(n) ? Math.trunc(n) : null;
  }

  const { error } = await db
    .from("posts")
    .update({
      title: title || row.title, // NOT NULL — keep existing if cleared mid-edit
      excerpt: strOrNull(o.excerpt),
      category_id: strOrNull(o.category_id),
      body_md: bodyMd,
      // Forgiving: a bad scheme (javascript:, data:, …) is dropped to null
      // rather than failing the background autosave.
      cover_image: normalizeImageUrl(o.cover_image).value,
      cover_alt: strOrNull(o.cover_alt),
      series_id: seriesId,
      series_order: seriesOrder,
      seo_title: strOrNull(o.seo_title),
      seo_description: strOrNull(o.seo_description),
      canonical_url: strOrNull(o.canonical_url),
      og_image: normalizeImageUrl(o.og_image).value,
      noindex: o.noindex === true,
      reading_minutes: readingMinutes(bodyMd),
    })
    .eq("id", id);

  if (error) {
    return serverError(error);
  }
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
