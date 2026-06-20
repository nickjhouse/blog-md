import { MEDIA_BUCKET } from "@/lib/media-url";

export const dynamic = "force-dynamic";

// On-domain image proxy. Re-serves public objects from the post-images bucket
// from example.com so reads come off Cloudflare instead of Supabase egress.
//
// We cache explicitly via the Workers Cache API (`caches.default`) rather than
// relying on Cloudflare's CDN cache, because OpenNext responses carry a `Vary:
// rsc,...` header that makes them CDN-uncacheable. We also keep a clean header
// set (no Vary) on what we store. Filenames are random + immutable, so TTL is 1y.
//
// Verify with: curl -sI https://example.com/media/<file> | grep -i x-media-cache
//   first request → MISS, subsequent (same edge) → HIT.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const key = (path ?? []).map(encodeURIComponent).join("/");
  if (!key) return new Response("Not found", { status: 404 });

  // Boundary cast (not a DB read): `caches.default` is a Cloudflare Workers
  // global the standard DOM `caches` (CacheStorage) type doesn't declare, and the
  // project loads both DOM + Workers libs, so the types conflict. Widen here to
  // reach the Workers cache. Optional `?.` keeps it safe if absent (e.g. dev).
  const cache = (
    globalThis as unknown as { caches?: { default?: Cache } }
  ).caches?.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: "GET" });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("x-media-cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const target = `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${key}`;
  const upstream = await fetch(target, {
    // Also let Cloudflare edge-cache the Supabase subrequest.
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  } as RequestInit).catch(() => null);
  if (!upstream || !upstream.ok) {
    return new Response("Not found", { status: 404 });
  }

  const buf = await upstream.arrayBuffer();
  // Clean, cacheable header set — deliberately no Vary.
  const headers = new Headers({
    "Content-Type":
      upstream.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  if (cache) {
    // Store a copy (without the per-response x-media-cache marker).
    await cache
      .put(cacheKey, new Response(buf, { status: 200, headers }))
      .catch(() => {});
  }

  const resHeaders = new Headers(headers);
  resHeaders.set("x-media-cache", "MISS");
  return new Response(buf, { status: 200, headers: resHeaders });
}
