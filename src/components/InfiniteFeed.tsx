"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostListItem } from "./PostListItem";
import type { PostListed } from "@/lib/posts";

// Page size for "load more" requests. Independent of the initial server fetch
// now — the API reports `hasMore`, so this no longer has to match it.
const PAGE = 10;

export function InfiniteFeed({
  initialPosts,
  initialHasMore,
  categoryId = null,
  emptyMessage = "No posts yet. Check back soon.",
}: {
  initialPosts: PostListed[];
  initialHasMore: boolean;
  categoryId?: string | null;
  emptyMessage?: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    // Keyset cursor: fetch posts after the last one we're showing, in
    // (published_at DESC, id DESC) order. Stable if a post is published mid-scroll.
    const last = posts[posts.length - 1];
    if (!last?.published_at) {
      setDone(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        cursorPublishedAt: last.published_at,
        cursorId: last.id,
      });
      if (categoryId) params.set("categoryId", categoryId);
      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        posts: PostListed[];
        hasMore: boolean;
      };
      setPosts((prev) => [...prev, ...data.posts]);
      if (!data.hasMore) setDone(true);
    } catch {
      setError("Couldn’t load more posts.");
    } finally {
      setLoading(false);
    }
  }, [loading, done, posts, categoryId]);

  // Auto-load as the sentinel (and its "Load more" button) nears the viewport.
  useEffect(() => {
    if (done) return;
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, done]);

  return (
    <div className="mt-6">
      {posts.length === 0 ? (
        <p className="text-black/60 dark:text-white/60">{emptyMessage}</p>
      ) : (
        posts.map((post) => <PostListItem key={post.id} post={post} />)
      )}

      {error ? <p className="mt-4 text-sm text-[color:var(--danger)]">{error}</p> : null}

      {!done && posts.length > 0 ? (
        <div ref={sentinel} className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-[color:var(--border-strong)] px-4 py-2 text-sm hover:bg-[color:var(--hover)] disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
