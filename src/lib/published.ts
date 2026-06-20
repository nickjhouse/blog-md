// Single source of truth for "what makes a post publicly live": it's published
// AND its publish time has arrived. Scheduled posts have status='published' with
// a FUTURE published_at, so a bare status check would wrongly treat them as live.

// `now` as an ISO string — used to filter `published_at <= now()` in queries.
export const nowISO = () => new Date().toISOString();

// JS-side predicate: is this post live right now? Null-tolerant (false for null).
export function isLive(
  p: { status: string; published_at: string | null } | null | undefined,
): boolean {
  return (
    !!p &&
    p.status === "published" &&
    !!p.published_at &&
    new Date(p.published_at).getTime() <= Date.now()
  );
}
