import { SITE_URL } from "@/lib/site.config";

// Pure, dependency-light URL helpers — safe to import from client or server.
// Images are stored as public Supabase Storage URLs; at render time we rewrite
// them to the on-domain `/media/<path>` proxy so Cloudflare caches them and the
// reads come off Supabase egress.

export const MEDIA_BUCKET = "post-images";

// Absolute prefix of a public object URL in the bucket, e.g.
// https://<ref>.supabase.co/storage/v1/object/public/post-images/
const PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${MEDIA_BUCKET}/`;

// The path portion (object key) of a bucket URL, or null if it isn't one.
export function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith(PREFIX) ? url.slice(PREFIX.length) : null;
}

// Map a stored bucket URL (or bare path) to the on-domain /media URL. Non-bucket
// URLs (external OG images, etc.) are returned unchanged.
export function mediaUrl(
  src: string | null | undefined,
  opts?: { absolute?: boolean },
): string {
  if (!src) return "";
  const path = src.startsWith(PREFIX)
    ? src.slice(PREFIX.length)
    : src.includes("://")
      ? null // some other absolute URL — leave it alone
      : src.replace(/^\/+/, ""); // already a bare path
  if (path == null) return src;
  const rel = `/media/${path}`;
  return opts?.absolute ? `${SITE_URL}${rel}` : rel;
}

// Rewrite every in-bucket image URL inside an HTML string to /media/<path>.
export function rewriteMediaHtml(html: string): string {
  if (!html) return html;
  return html.split(PREFIX).join("/media/");
}

// Every in-bucket object path referenced anywhere in a string (markdown or
// HTML). Used at save time to look up stored image dimensions. Pure.
export function bucketPathsIn(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  let i = 0;
  while ((i = text.indexOf(PREFIX, i)) !== -1) {
    const start = i + PREFIX.length;
    const m = text.slice(start).match(/^[^"')\s]+/);
    if (m) out.push(decodeURIComponent(m[0]));
    i = start;
  }
  return out;
}
