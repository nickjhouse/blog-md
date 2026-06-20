// Best-effort in-memory, per-isolate fixed-window rate limiter.
//
// ⚠️  Cloudflare runs many Worker isolates, each with its OWN module memory (and
// they recycle), so this is NOT a global guarantee — it caps a single client
// hammering one isolate, not a distributed flood. That's an accepted trade-off
// for the low-harm `/api/track` endpoint: the one free Cloudflare WAF
// rate-limiting rule is spent on the email endpoints (contact/newsletter), and
// track only writes tightly-constrained analytics rows. For a strong global
// limit, use the edge WAF rule or a Durable Object (see error-report.ts, which
// uses a DB ledger precisely because it needs a global cap).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // bound memory if many distinct IPs hit one isolate

/**
 * Returns true if the request is within the limit, false if it should be denied.
 * Fixed window: the first request for a key starts a `windowMs` window; up to
 * `limit` requests are allowed within it, then it resets.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      // Sweep expired entries; if still full, clear outright (cheap + rare).
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= limit;
}

// Best-effort client IP from Cloudflare / proxy headers.
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
