import type { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSettings } from "@/lib/settings";
import { BRAND_BUCKET } from "@/lib/brand";
import { SITE_URL } from "@/lib/site.config";

export const dynamic = "force-dynamic";

// Serves the current brand mark from THIS domain (so structured-data / logo URLs
// read `example.com/...` instead of the Supabase storage host). For a custom
// upload it proxies the bytes; for the default it redirects to the committed
// on-domain file. Both keep the URL on the site's own domain.
//
// EDGE-CACHED: the favicon + nav logo request this on every page view, and
// re-running getSettings + the storage proxy each time exceeds the Workers CPU
// limit (1102). The proxied response is stored in the Cloudflare cache, so only
// the first request per cache key pays that cost; repeat hits are served from
// cache (well under the CPU limit) WITHOUT changing the on-domain URL. Callers
// append `?v={brand_icon_version}`, so changing the mark gives a new cache key
// and busts it automatically; the 1h max-age refreshes it otherwise.
export async function GET(req: NextRequest): Promise<Response> {
  // caches.default exists only on the Workers runtime; in `next dev` (Node) it's
  // absent, so guard it and fall through to an uncached proxy locally.
  const cache =
    typeof caches !== "undefined" && "default" in caches
      ? caches.default
      : undefined;
  const cacheKey = new Request(req.url, { method: "GET" });
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return cached;

  const settings = await getSettings();

  if (!settings.brand_icon_path) {
    return Response.redirect(`${SITE_URL}/brand/icon.svg`, 302);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const target = `${base}/storage/v1/object/public/${BRAND_BUCKET}/${settings.brand_icon_path}`;
  const upstream = await fetch(target).catch(() => null);
  if (!upstream || !upstream.ok) {
    // Fall back to the committed default (still on-domain) if the proxy fails.
    return Response.redirect(`${SITE_URL}/brand/icon.svg`, 302);
  }

  const buf = await upstream.arrayBuffer();
  const contentType = settings.brand_icon_path.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/svg+xml";
  const response = new Response(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });

  // Store the proxied bytes at the edge for subsequent hits. waitUntil so it
  // doesn't add latency to this response. Guarded: cache + getCloudflareContext
  // only exist on the Worker runtime (skipped in `next dev`).
  if (cache) {
    try {
      const { ctx } = getCloudflareContext();
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // Not on the Worker runtime (e.g. build-time) — skip caching.
    }
  }

  return response;
}
