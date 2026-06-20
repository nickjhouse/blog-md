import { NextResponse, type NextRequest } from "next/server";
import { getPostsPage } from "@/lib/posts";

// Request-dependent GET (reads searchParams; cursor pagination shouldn't be
// cached or it'd serve stale pages) → never cache.
export const dynamic = "force-dynamic";

// Public, read-only pagination endpoint backing the infinite-scroll feed. Returns
// the next page of published posts (optionally within a category) after the given
// keyset cursor, plus a `hasMore` flag.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
  const categoryId = searchParams.get("categoryId") || null;
  const cursorPublishedAt = searchParams.get("cursorPublishedAt");
  const cursorId = searchParams.get("cursorId");
  const cursor =
    cursorPublishedAt && cursorId
      ? { publishedAt: cursorPublishedAt, id: cursorId }
      : null;

  try {
    const { posts, hasMore } = await getPostsPage({ limit, categoryId, cursor });
    return NextResponse.json({ posts, hasMore });
  } catch {
    return NextResponse.json({ error: "Failed to load posts." }, { status: 500 });
  }
}
