"use client";

import { useEffect, useState } from "react";
import { useSession } from "./SessionProvider";

type Props = {
  postId: string;
  postSlug: string;
};

function BookmarkIcon({ filled }: { filled: boolean }) {
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
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BookmarkButton({ postId, postSlug }: Props) {
  // The viewer's own bookmark state is fetched client-side so the page render
  // carries no per-user data.
  const { session } = useSession();
  const isSignedIn = !!session;
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!session) {
      setSaved(false);
      return;
    }
    let active = true;
    fetch(`/api/bookmarks?postId=${encodeURIComponent(postId)}`)
      .then((r) => (r.ok ? r.json() : { bookmarked: false }))
      .then((d: { bookmarked?: boolean }) => {
        if (active) setSaved(!!d.bookmarked);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session, postId]);

  if (!isSignedIn) {
    return (
      <a
        href={`/login?next=/post/${postSlug}`}
        aria-label="Sign in to save this post"
        className="inline-flex items-center gap-2 rounded-md border border-(--border-strong) px-3 py-1.5 text-sm text-(--muted) hover:bg-(--hover)"
      >
        <BookmarkIcon filled={false} />
        <span>Save</span>
      </a>
    );
  }

  async function toggle() {
    if (pending) return;
    const next = !saved;
    setSaved(next);
    setPending(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { bookmarked: boolean };
      setSaved(data.bookmarked);
    } catch {
      setSaved(!next); // revert
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save for later"}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
        saved
          ? "border-(--accent) text-(--accent)"
          : "border-(--border-strong) text-(--muted) hover:bg-(--hover)"
      }`}
    >
      <BookmarkIcon filled={saved} />
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
