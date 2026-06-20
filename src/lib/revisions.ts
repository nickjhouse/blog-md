import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// The editable snapshot stored per save. Mirrors the post's content + metadata
// fields (body_html is re-derived, so it isn't stored). status/published_at are
// recorded for the audit trail but restore-into-editor leaves live state to the
// user (see RevisionHistory).
export type RevisionSnapshot = {
  postId: string;
  editedBy: string;
  title: string;
  slug: string;
  body_md: string;
  excerpt: string | null;
  category_id: string | null;
  cover_image: string | null;
  cover_alt: string | null;
  status: "draft" | "published";
  published_at: string | null;
  series_id: string | null;
  series_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  noindex: boolean;
  tags: string[];
};

// One row in the history list (lightweight — no body).
export type RevisionSummary = {
  id: string;
  createdAt: string;
  editorName: string | null;
  title: string | null;
  bodyLength: number;
};

// Full revision for the diff + restore.
export type RevisionFull = {
  id: string;
  createdAt: string;
  editorName: string | null;
  title: string;
  slug: string;
  body_md: string;
  excerpt: string | null;
  category_id: string | null;
  cover_image: string | null;
  cover_alt: string | null;
  series_id: string | null;
  series_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  noindex: boolean;
  tags: string[];
};

// Best-effort: append a snapshot. A revision failure must NEVER break a save, so
// errors are swallowed (logged). Call AFTER the post write + tag sync succeed.
export async function captureRevision(
  admin: AdminClient,
  s: RevisionSnapshot,
): Promise<void> {
  try {
    const { error } = await admin.from("post_revisions").insert({
      post_id: s.postId,
      edited_by: s.editedBy,
      title: s.title,
      slug: s.slug,
      body_md: s.body_md,
      excerpt: s.excerpt,
      category_id: s.category_id,
      cover_image: s.cover_image,
      cover_alt: s.cover_alt,
      status: s.status,
      published_at: s.published_at,
      series_id: s.series_id,
      series_order: s.series_order,
      seo_title: s.seo_title,
      seo_description: s.seo_description,
      canonical_url: s.canonical_url,
      og_image: s.og_image,
      noindex: s.noindex,
      tags: s.tags,
    });
    if (error) console.error("captureRevision:", error.message);
  } catch (e) {
    console.error("captureRevision:", e);
  }
}

// Resolve editor display labels (full_name || display_name) for a set of ids.
async function editorNames(
  admin: AdminClient,
  ids: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;
  const { data } = await admin
    .from("profiles")
    .select("id, display_name, full_name")
    .in("id", ids);
  for (const p of (data ?? []) as {
    id: string;
    display_name: string | null;
    full_name: string | null;
  }[]) {
    map.set(p.id, p.full_name?.trim() || p.display_name || null);
  }
  return map;
}

// History list (newest first). Service-role read — the caller must already have
// authorized access to the post.
export async function listRevisions(
  postId: string,
): Promise<RevisionSummary[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("post_revisions")
    .select("id, created_at, edited_by, title, body_md")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as {
    id: string;
    created_at: string;
    edited_by: string | null;
    title: string | null;
    body_md: string | null;
  }[];
  const names = await editorNames(
    admin,
    [...new Set(rows.map((r) => r.edited_by).filter((x): x is string => !!x))],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    editorName: r.edited_by ? (names.get(r.edited_by) ?? null) : null,
    title: r.title,
    bodyLength: r.body_md?.length ?? 0,
  }));
}

// A single revision (for diffing + restoring). Returns null if it isn't part of
// the given post (defends against id-swapping across posts).
export async function getRevision(
  postId: string,
  revisionId: string,
): Promise<RevisionFull | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("post_revisions")
    .select("*")
    .eq("id", revisionId)
    .eq("post_id", postId)
    .maybeSingle();
  if (!data) return null;
  const r = data as {
    id: string;
    created_at: string;
    edited_by: string | null;
    title: string | null;
    slug: string | null;
    body_md: string | null;
    excerpt: string | null;
    category_id: string | null;
    cover_image: string | null;
    cover_alt: string | null;
    series_id: string | null;
    series_order: number | null;
    seo_title: string | null;
    seo_description: string | null;
    canonical_url: string | null;
    og_image: string | null;
    noindex: boolean;
    tags: string[];
  };
  const names = r.edited_by
    ? await editorNames(admin, [r.edited_by])
    : new Map<string, string | null>();
  return {
    id: r.id,
    createdAt: r.created_at,
    editorName: r.edited_by ? (names.get(r.edited_by) ?? null) : null,
    title: r.title ?? "",
    slug: r.slug ?? "",
    body_md: r.body_md ?? "",
    excerpt: r.excerpt,
    category_id: r.category_id,
    cover_image: r.cover_image,
    cover_alt: r.cover_alt,
    series_id: r.series_id,
    series_order: r.series_order,
    seo_title: r.seo_title,
    seo_description: r.seo_description,
    canonical_url: r.canonical_url,
    og_image: r.og_image,
    noindex: r.noindex,
    tags: r.tags ?? [],
  };
}
