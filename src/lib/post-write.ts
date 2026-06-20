import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { markdownToSafeHtml } from "@/lib/markdown";
import { deriveExcerpt, readingMinutes } from "@/lib/content";
import { captureRevision } from "@/lib/revisions";
import { imageDimensions } from "@/lib/media";
import { bucketPathsIn } from "@/lib/media-url";
import type { PostInput } from "@/lib/post-input";

type AdminClient = SupabaseClient<Database>;

/**
 * Build the `posts` insert/update row from validated input. Centralizes the 18
 * shared columns + the derived `body_html` / `excerpt` / `reading_minutes`, so
 * the create (POST) and update (PUT) routes can't drift. `excerpt` falls back to
 * a derived one here; the revision snapshot deliberately keeps the RAW input
 * excerpt (see `captureRevisionFromInput`).
 */
export async function buildPostRow(
  input: PostInput,
  opts: {
    authorId: string | null;
    publishedAt: string | null;
    admin: AdminClient;
  },
) {
  // Look up stored dimensions for body images so they're stamped with width/
  // height (reserves their slot, no reflow). Only images in the media library
  // resolve; external/pasted URLs are simply left without dimensions.
  const dims = await imageDimensions(opts.admin, bucketPathsIn(input.body_md));
  return {
    title: input.title,
    slug: input.slug,
    category_id: input.category_id,
    excerpt: input.excerpt ?? deriveExcerpt(input.body_md),
    body_md: input.body_md,
    body_html: await markdownToSafeHtml(input.body_md, dims),
    cover_image: input.cover_image,
    cover_alt: input.cover_alt,
    status: input.status,
    reading_minutes: readingMinutes(input.body_md),
    published_at: opts.publishedAt,
    series_id: input.series_id,
    series_order: input.series_id ? input.series_order : null,
    author_id: opts.authorId,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
    canonical_url: input.canonical_url,
    og_image: input.og_image,
    noindex: input.noindex,
  };
}

/**
 * Snapshot the just-saved version into `post_revisions`. Mirrors the row but
 * keeps the RAW input `excerpt` (not the derived one) and includes tags.
 * Best-effort — `captureRevision` swallows its own errors and never throws.
 */
export async function captureRevisionFromInput(
  admin: AdminClient,
  input: PostInput,
  opts: { postId: string; editedBy: string; publishedAt: string | null },
): Promise<void> {
  await captureRevision(admin, {
    postId: opts.postId,
    editedBy: opts.editedBy,
    title: input.title,
    slug: input.slug,
    body_md: input.body_md,
    excerpt: input.excerpt,
    category_id: input.category_id,
    cover_image: input.cover_image,
    cover_alt: input.cover_alt,
    status: input.status,
    published_at: opts.publishedAt,
    series_id: input.series_id,
    series_order: input.series_id ? input.series_order : null,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
    canonical_url: input.canonical_url,
    og_image: input.og_image,
    noindex: input.noindex,
    tags: input.tags,
  });
}
