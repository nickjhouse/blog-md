"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "./SessionProvider";

type Props = {
  postId: string;
  postSlug: string;
  initialCount: number;
};

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export function ReactionButton({ postId, postSlug, initialCount }: Props) {
  // initialCount is the server-rendered first paint, but it can be stale because
  // the post page is cached under ISR. We refresh the live count and the
  // viewer's own liked state from the no-store API on mount (and whenever the
  // session changes), so the displayed count is always current.
  const { session } = useSession();
  const isSignedIn = !!session;
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);
  // Bumped on every toggle. The refresh fetch records the value when it starts
  // and only applies its result if it hasn't changed — so a GET that resolves
  // AFTER the user toggled can't clobber the toggle's (authoritative) result.
  const mutations = useRef(0);

  // Refresh count + liked. Runs for signed-out readers too (the count is
  // global) — that's the case where the cached page is most likely stale.
  useEffect(() => {
    let active = true;
    const startedAt = mutations.current;
    fetch(`/api/reactions?postId=${encodeURIComponent(postId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { liked?: boolean; count?: number } | null) => {
        if (!active || mutations.current !== startedAt || !d) return;
        setLiked(!!d.liked);
        if (typeof d.count === "number") setCount(d.count);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session, postId]);

  const label = `${liked ? "Unlike" : "Like"} this post — ${count} ${
    count === 1 ? "like" : "likes"
  }`;

  // Signed out (or session not yet resolved): send them to sign in, then back.
  if (!isSignedIn) {
    return (
      <a
        href={`/login?next=/post/${postSlug}`}
        aria-label="Sign in to like this post"
        className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 text-sm text-[color:var(--muted)] hover:bg-[color:var(--hover)]"
      >
        <Heart filled={false} />
        <span>{count}</span>
      </a>
    );
  }

  async function toggle() {
    if (pending) return;
    // Mark an interaction so any in-flight refresh GET discards its stale result.
    mutations.current += 1;
    // Optimistic update.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    setPending(true);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      // Revert on failure.
      setLiked(!nextLiked);
      setCount((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={label}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
        liked
          ? "border-[color:var(--accent)] text-[color:var(--accent)]"
          : "border-[color:var(--border-strong)] text-[color:var(--muted)] hover:bg-[color:var(--hover)]"
      }`}
    >
      <Heart filled={liked} />
      <span>{count}</span>
    </button>
  );
}
