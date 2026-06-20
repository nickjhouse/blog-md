import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, pathFromUrl } from "@/lib/media-url";

// Server-side Media Library helpers. The bucket is the source of truth for what
// exists; the `media` table adds metadata (alt, uploader, dimensions). Usage is
// computed by scanning posts for references. All callers must be contributor-gated.

const MARKER = `/storage/v1/object/public/${MEDIA_BUCKET}/`;

export type UsedInPost = { id: string; title: string; slug: string };

export type MediaItem = {
  path: string;
  url: string; // public Supabase URL (canonical; rewritten to /media at render)
  size_bytes: number | null;
  content_type: string | null;
  alt: string | null;
  created_at: string | null;
  used: number; // number of posts referencing this image
};

function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

// Map each referenced object path to the posts (cover, OG, or inline body) that
// use it. Each post is counted at most once per image.
async function referencedPaths(
  db: ReturnType<typeof createAdminClient>,
): Promise<Map<string, UsedInPost[]>> {
  const refs = new Map<string, UsedInPost[]>();
  const { data } = await db
    .from("posts")
    .select("id, title, slug, cover_image, og_image, body_html");
  const posts = data ?? [];
  for (const p of posts) {
    const seen = new Set<string>(); // count each post once per image
    const add = (path: string | null) => {
      if (!path || seen.has(path)) return;
      seen.add(path);
      const list = refs.get(path) ?? [];
      list.push({ id: p.id, title: p.title, slug: p.slug });
      refs.set(path, list);
    };
    add(pathFromUrl(p.cover_image));
    add(pathFromUrl(p.og_image));
    if (p.body_html) {
      let idx = 0;
      while ((idx = p.body_html.indexOf(MARKER, idx)) !== -1) {
        const start = idx + MARKER.length;
        const m = p.body_html.slice(start).match(/^[^"')\s]+/);
        if (m) add(decodeURIComponent(m[0]));
        idx = start;
      }
    }
  }
  return refs;
}

export async function listMedia(opts?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const limit = opts?.limit ?? 60;
  const offset = opts?.offset ?? 0;
  const db = createAdminClient();

  const { data: files, error } = await db.storage.from(MEDIA_BUCKET).list("", {
    limit,
    offset,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  const rows = (files ?? []).filter((f) => f.name && f.id !== null); // skip folders

  const paths = rows.map((f) => f.name);
  const [{ data: metaRows }, usage] = await Promise.all([
    paths.length
      ? db.from("media").select("path, alt").in("path", paths)
      : Promise.resolve({ data: [] as { path: string; alt: string | null }[] }),
    referencedPaths(db),
  ]);
  const altByPath = new Map(
    ((metaRows ?? []) as { path: string; alt: string | null }[]).map((r) => [
      r.path,
      r.alt,
    ]),
  );

  const items: MediaItem[] = rows.map((f) => ({
    path: f.name,
    url: publicUrl(f.name),
    size_bytes: (f.metadata?.size as number | undefined) ?? null,
    content_type: (f.metadata?.mimetype as string | undefined) ?? null,
    alt: altByPath.get(f.name) ?? null,
    created_at: f.created_at ?? null,
    used: usage.get(f.name)?.length ?? 0,
  }));

  return { items, hasMore: rows.length === limit };
}

// Record (or update) metadata for an uploaded object. Called after upload.
export async function recordMedia(input: {
  path: string;
  size_bytes?: number | null;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  uploaded_by?: string | null;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("media").upsert(
    {
      path: input.path,
      size_bytes: input.size_bytes ?? null,
      content_type: input.content_type ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      alt: input.alt ?? null,
      uploaded_by: input.uploaded_by ?? null,
    },
    { onConflict: "path" },
  );
  // Best-effort metadata, but don't fail silently — a swallowed error here is
  // exactly what hid the missing service_role grant (see migration 0043).
  if (error) console.error("recordMedia upsert failed:", error.message);
}

// Stored intrinsic dimensions for a set of object paths. Used at save time to
// stamp width/height onto body <img> tags so the layout reserves their slot
// before they load (no reflow). Only images with both dimensions recorded are
// returned; unknown/external images are simply absent.
export async function imageDimensions(
  db: ReturnType<typeof createAdminClient>,
  paths: string[],
): Promise<Map<string, { width: number; height: number }>> {
  const out = new Map<string, { width: number; height: number }>();
  const unique = [...new Set(paths)].filter(Boolean);
  if (!unique.length) return out;
  const { data } = await db
    .from("media")
    .select("path, width, height")
    .in("path", unique);
  const rows = data ?? [];
  for (const r of rows) {
    if (r.width && r.height) out.set(r.path, { width: r.width, height: r.height });
  }
  return out;
}

// How many posts reference a given object path.
export async function mediaUsage(path: string): Promise<number> {
  const db = createAdminClient();
  return (await referencedPaths(db)).get(path)?.length ?? 0;
}

// Which posts reference a given object path.
export async function mediaUsageDetail(path: string): Promise<UsedInPost[]> {
  const db = createAdminClient();
  return (await referencedPaths(db)).get(path) ?? [];
}

// Delete an object from the bucket and its metadata row.
export async function deleteMedia(path: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
  await db.from("media").delete().eq("path", path);
}

// Delete many objects + their metadata rows in one pass (bulk Library delete).
// storage.remove() takes the whole list, and the metadata rows go in one .in().
export async function bulkDeleteMedia(paths: string[]): Promise<void> {
  const db = createAdminClient();
  const unique = [...new Set(paths)].filter(Boolean);
  if (!unique.length) return;
  const { error } = await db.storage.from(MEDIA_BUCKET).remove(unique);
  if (error) throw error;
  await db.from("media").delete().in("path", unique);
}

// Of the given paths, which are still referenced by at least one post. One scan
// for the whole set (vs. mediaUsage() per path).
export async function mediaUsageMany(paths: string[]): Promise<string[]> {
  const db = createAdminClient();
  const ref = await referencedPaths(db);
  return paths.filter((p) => (ref.get(p)?.length ?? 0) > 0);
}

// All bucket objects not referenced by any post.
export async function findOrphans(): Promise<MediaItem[]> {
  const db = createAdminClient();
  const usage = await referencedPaths(db);
  const orphans: MediaItem[] = [];
  // Page through the whole bucket.
  for (let offset = 0; ; offset += 100) {
    const { data: files, error } = await db.storage
      .from(MEDIA_BUCKET)
      .list("", { limit: 100, offset });
    if (error) throw error;
    const rows = (files ?? []).filter((f) => f.name && f.id !== null);
    for (const f of rows) {
      if (!usage.has(f.name)) {
        orphans.push({
          path: f.name,
          url: publicUrl(f.name),
          size_bytes: (f.metadata?.size as number | undefined) ?? null,
          content_type: (f.metadata?.mimetype as string | undefined) ?? null,
          alt: null,
          created_at: f.created_at ?? null,
          used: 0,
        });
      }
    }
    if (rows.length < 100) break;
  }
  return orphans;
}
