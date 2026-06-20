"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { withinEditWindow } from "@/lib/comments-config";
import { useSession } from "./SessionProvider";
import type { CommentItem } from "@/lib/comments";

// Per-user viewer summary, fetched alongside the thread from /api/comments (so
// the post page renders no comments/viewer data and stays cache-safe).
type CommentsViewer = {
  userId: string;
  displayName: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
} | null;

type Props = {
  postId: string;
  postSlug: string;
};

const honeypotStyle: React.CSSProperties = {
  position: "absolute",
  left: "-9999px",
  width: 1,
  height: 1,
  opacity: 0,
};

export function Comments({ postId, postSlug }: Props) {
  // Thread + viewer are fetched client-side (always live, decoupled from the
  // cached page). loading covers the initial fetch.
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [viewer, setViewer] = useState<CommentsViewer>(null);
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [body, setBody] = useState("");
  const [hp, setHp] = useState(""); // honeypot — real users leave it empty
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  // Fetch (and re-fetch after any mutation) — replaces router.refresh(), which
  // would have re-rendered the server page; the thread is now client-owned.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comments?postId=${encodeURIComponent(postId)}`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const d = (await res.json()) as {
          comments?: CommentItem[];
          viewer?: CommentsViewer;
          blockedAuthorIds?: string[];
        };
        setComments(d.comments ?? []);
        setViewer(d.viewer ?? null);
        setBlockedAuthorIds(d.blockedAuthorIds ?? []);
      }
    } catch {
      // leave prior state; error surfaced only for explicit actions
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Re-fetch on mount and whenever the signed-in user changes (login/logout), so
  // the comment form + per-comment affordances update without a hard refresh.
  const sessionUserId = useSession().session?.userId ?? null;
  useEffect(() => {
    refresh();
  }, [refresh, sessionUserId]);

  const blockedSet = new Set(blockedAuthorIds);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, CommentItem[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesByParent.get(c.parent_id) ?? [];
      arr.push(c);
      repliesByParent.set(c.parent_id, arr);
    }
  }

  async function postComment(
    text: string,
    parentId: string | null,
  ): Promise<boolean> {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        body: text,
        parent_id: parentId,
        website: hp,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not post comment.");
      return false;
    }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    const ok = await postComment(body, null);
    setSubmitting(false);
    if (ok) {
      setBody("");
      refresh();
    }
  }

  async function submitReply(e: React.FormEvent, parentId: string) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    setError(null);
    const ok = await postComment(replyBody, parentId);
    setSubmitting(false);
    if (ok) {
      setReplyBody("");
      setReplyTo(null);
      refresh();
    }
  }

  async function report(id: string) {
    setError(null);
    const res = await fetch(`/api/comments/${id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not report comment.");
      return;
    }
    setReportedIds((prev) => new Set(prev).add(id));
  }

  function startEdit(c: CommentItem) {
    setEditingId(c.id);
    setEditBody(c.body);
    setError(null);
  }

  async function saveEdit(id: string) {
    if (!editBody.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save edit.");
      return;
    }
    setEditingId(null);
    setEditBody("");
    refresh();
  }

  async function runAction(url: string, options: RequestInit) {
    setError(null);
    const res = await fetch(url, options);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Something went wrong.");
      return;
    }
    refresh();
  }

  function renderComment(c: CommentItem) {
    const name = c.author?.display_name?.trim() || "Anonymous";
    const initials = name.slice(0, 1).toUpperCase();
    const canDelete =
      viewer && (viewer.isAdmin || viewer.userId === c.author_id);
    const isOwn = viewer?.userId === c.author_id;
    const canReport =
      !!viewer &&
      !viewer.isAdmin &&
      !isOwn &&
      !viewer.isBlocked &&
      c.status === "visible";
    const canEdit =
      isOwn && c.status !== "hidden" && withinEditWindow(c.created_at);
    const reported = reportedIds.has(c.id);
    const editing = editingId === c.id;

    return (
      <div className={c.status === "hidden" ? "opacity-50" : ""}>
        <div className="flex items-center gap-2">
          {c.author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.author.avatar_url}
              alt=""
              width={28}
              height={28}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--border-strong)] text-xs font-medium">
              {initials}
            </span>
          )}
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-black/55 dark:text-white/40">
            {formatDate(c.created_at)}
          </span>
          {c.edited_at ? (
            <span className="text-xs text-[color:var(--muted)]">(edited)</span>
          ) : null}
          {c.status === "hidden" ? (
            <span className="text-xs text-amber-600">hidden</span>
          ) : null}
          {c.status === "pending" ? (
            <span className="text-xs text-blue-700 dark:text-blue-400">
              awaiting approval
            </span>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => saveEdit(c.id)}
                disabled={submitting || !editBody.trim()}
                className="rounded-md bg-[color:var(--button-bg)] px-3 py-1 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditBody("");
                }}
                className="rounded-md border border-[color:var(--border-strong)] px-3 py-1 text-sm hover:bg-[color:var(--hover)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-black/80 dark:text-white/80">
            {c.body}
          </p>
        )}

        {viewer?.isAdmin || canDelete || canReport || canEdit ? (
          <div className="mt-1 flex gap-3 text-xs text-[color:var(--muted)]">
            {canEdit && !editing ? (
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="hover:underline"
              >
                Edit
              </button>
            ) : null}
            {canReport ? (
              reported ? (
                <span>Reported ✓</span>
              ) : (
                <button
                  type="button"
                  onClick={() => report(c.id)}
                  className="hover:underline"
                >
                  Report
                </button>
              )
            ) : null}
            {viewer?.isAdmin ? (
              <button
                type="button"
                onClick={() =>
                  runAction(`/api/comments/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: c.status === "hidden" ? "visible" : "hidden",
                    }),
                  })
                }
                className="hover:underline"
              >
                {c.status === "hidden" ? "Unhide" : "Hide"}
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this comment?")) {
                    runAction(`/api/comments/${c.id}`, { method: "DELETE" });
                  }
                }}
                className="hover:underline"
              >
                Delete
              </button>
            ) : null}
            {viewer?.isAdmin && !isOwn ? (
              (() => {
                const blocked = blockedSet.has(c.author_id);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !blocked;
                      const msg = next
                        ? `Block ${name} from commenting?`
                        : `Unblock ${name}?`;
                      if (confirm(msg)) {
                        runAction(`/api/admin/users/${c.author_id}/block`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ blocked: next }),
                        });
                      }
                    }}
                    className={
                      blocked
                        ? "text-[color:var(--success)] hover:underline"
                        : "text-[color:var(--danger)] hover:underline"
                    }
                  >
                    {blocked ? "Unblock user" : "Block user"}
                  </button>
                );
              })()
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const canReply = !!viewer && !viewer.isBlocked && !!viewer.displayName;

  return (
    <section className="mt-12 border-t border-[color:var(--border)] pt-8">
      <h2 className="text-xl font-bold">
        Comments{!loading && comments.length ? ` (${comments.length})` : ""}
      </h2>

      {loading ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          Loading comments…
        </p>
      ) : (
        <>
          {viewer ? (
            viewer.isBlocked ? (
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                Your account is not allowed to post comments.
              </p>
            ) : !viewer.displayName ? (
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                <Link
                  href={`/welcome?next=/post/${postSlug}`}
                  className="underline"
                >
                  Choose a username
                </Link>{" "}
                to start commenting.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-4">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder="Add a comment…"
                  className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
                />
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  style={honeypotStyle}
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting || !body.trim()}
                    className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50 "
                  >
                    {submitting ? "Posting…" : "Post comment"}
                  </button>
                </div>
              </form>
            )
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">
              <Link href={`/login?next=/post/${postSlug}`} className="underline">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/signup" className="underline">
                create an account
              </Link>{" "}
              to comment.
            </p>
          )}

          {error ? (
            <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p>
          ) : null}

          <div className="mt-8 space-y-6">
            {topLevel.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">
                No comments yet.
              </p>
            ) : (
              topLevel.map((c) => {
                const replies = repliesByParent.get(c.id) ?? [];
                return (
                  <div key={c.id}>
                    {renderComment(c)}

                    {canReply && c.status === "visible" ? (
                      replyTo === c.id ? (
                        <form
                          onSubmit={(e) => submitReply(e, c.id)}
                          className="ml-9 mt-3"
                        >
                          <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={2}
                            maxLength={5000}
                            placeholder={`Reply to ${c.author?.display_name?.trim() || "this comment"}…`}
                            className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
                          />
                          <input
                            type="text"
                            name="website"
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden="true"
                            value={hp}
                            onChange={(e) => setHp(e.target.value)}
                            style={honeypotStyle}
                          />
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <button
                              type="submit"
                              disabled={submitting || !replyBody.trim()}
                              className="rounded-md bg-[color:var(--button-bg)] px-3 py-1.5 font-medium text-[color:var(--button-fg)] disabled:opacity-50 "
                            >
                              {submitting ? "Posting…" : "Post reply"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTo(null);
                                setReplyBody("");
                              }}
                              className="text-black/60 hover:underline dark:text-white/60"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(c.id);
                            setReplyBody("");
                          }}
                          className="mt-1 text-xs text-black/60 hover:underline dark:text-white/50"
                        >
                          Reply
                        </button>
                      )
                    ) : null}

                    {replies.length > 0 ? (
                      <div className="mt-4 space-y-4 border-l border-[color:var(--border)] pl-4">
                        {replies.map((r) => (
                          <div key={r.id}>{renderComment(r)}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}
