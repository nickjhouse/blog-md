// Draft autosave snapshot + localStorage helpers (client-only). The snapshot is
// the full editor state, so a restore brings back everything — not just the body.
// Storage access is guarded (SSR + private-mode/quota failures never throw).

export type DraftSnapshot = {
  title: string;
  slug: string;
  slugLocked: boolean;
  categoryId: string;
  excerpt: string;
  coverImage: string;
  coverAlt: string;
  bodyMd: string;
  tags: string[];
  publishAt: string;
  seriesId: string;
  seriesOrder: string;
  authorId: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  noindex: boolean;
  savedAt: number; // ms epoch of the local save
};

// Everything except the timestamp — used to decide whether a snapshot actually
// differs from the loaded post (so we don't prompt to "restore" identical state).
export type DraftContent = Omit<DraftSnapshot, "savedAt">;

const PREFIX = "blog:post-draft:";

export function draftKey(postId: string | null): string {
  return `${PREFIX}${postId ?? "new"}`;
}

export function readDraft(postId: string | null): DraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(postId));
    return raw ? (JSON.parse(raw) as DraftSnapshot) : null;
  } catch {
    return null;
  }
}

export function writeDraft(postId: string | null, snap: DraftSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(postId), JSON.stringify(snap));
  } catch {
    // storage unavailable / quota exceeded — autosave is best-effort
  }
}

export function clearDraft(postId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(postId));
  } catch {
    // ignore
  }
}

// True when two snapshots hold the same content (ignoring savedAt). Compares
// fields explicitly so key order can't cause false differences.
const CONTENT_KEYS: (keyof DraftContent)[] = [
  "title",
  "slug",
  "slugLocked",
  "categoryId",
  "excerpt",
  "coverImage",
  "coverAlt",
  "bodyMd",
  "tags",
  "publishAt",
  "seriesId",
  "seriesOrder",
  "authorId",
  "seoTitle",
  "seoDescription",
  "canonicalUrl",
  "ogImage",
  "noindex",
];
export function sameContent(a: DraftContent, b: DraftContent): boolean {
  return CONTENT_KEYS.every(
    (k) => JSON.stringify(a[k]) === JSON.stringify(b[k]),
  );
}
