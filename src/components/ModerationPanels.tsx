"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import type {
  PendingComment,
  ReportedComment,
  BlockedUser,
} from "@/lib/moderation";

type Props = {
  pending: PendingComment[];
  reported: ReportedComment[];
  blocked: BlockedUser[];
};

const muted = "text-black/60 dark:text-white/60";

// The moderation review queues. Comment settings + filtered words live under
// Settings → Comments; this page is operational review only.
export function ModerationPanels({ pending, reported, blocked }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function action(url: string, options: RequestInit) {
    setError(null);
    const res = await fetch(url, options);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  const patchStatus = (id: string, status: "visible" | "hidden") =>
    action(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  const del = (id: string) => {
    if (confirm("Delete this comment? This cannot be undone.")) {
      action(`/api/comments/${id}`, { method: "DELETE" });
    }
  };

  const actionBtn = "hover:underline";

  return (
    <div className="mt-6 space-y-10">
      {error ? <p className="text-sm text-(--danger)">{error}</p> : null}

      <section>
        <h2 className="text-lg font-semibold">
          Needs review{pending.length ? ` (${pending.length})` : ""}
        </h2>
        {pending.length === 0 ? (
          <p className={`mt-2 text-sm ${muted}`}>Nothing awaiting approval.</p>
        ) : (
          <div className="mt-3">
            {pending.map((c) => (
              <div
                key={c.id}
                className="border-t border-(--border) py-3"
              >
                <div className={`text-xs ${muted}`}>
                  {c.authorName ?? "Anonymous"}
                  <span aria-hidden> · </span>
                  <Link href={`/post/${c.postSlug}`} className="hover:underline">
                    {c.postTitle}
                  </Link>
                  <span aria-hidden> · </span>
                  {formatDate(c.created_at)}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                <div className={`mt-1 flex gap-3 text-xs ${muted}`}>
                  <button
                    type="button"
                    onClick={() => patchStatus(c.id, "visible")}
                    className="text-green-700 hover:underline dark:text-green-500"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => patchStatus(c.id, "hidden")}
                    className={actionBtn}
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => del(c.id)}
                    className="text-(--danger) hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Reported{reported.length ? ` (${reported.length})` : ""}
        </h2>
        {reported.length === 0 ? (
          <p className={`mt-2 text-sm ${muted}`}>No reported comments.</p>
        ) : (
          <div className="mt-3">
            {reported.map((c) => (
              <div
                key={c.id}
                className="border-t border-(--border) py-3"
              >
                <div className={`text-xs ${muted}`}>
                  {c.authorName ?? "Anonymous"}
                  <span aria-hidden> · </span>
                  <Link href={`/post/${c.postSlug}`} className="hover:underline">
                    {c.postTitle}
                  </Link>
                  <span aria-hidden> · </span>
                  {c.reportCount} report{c.reportCount === 1 ? "" : "s"}
                  {c.status === "hidden" ? (
                    <span className="text-amber-600"> · hidden</span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                {c.reasons.length ? (
                  <ul className={`mt-1 text-xs ${muted}`}>
                    {c.reasons.map((r, i) => (
                      <li key={i}>“{r}”</li>
                    ))}
                  </ul>
                ) : null}
                <div className={`mt-1 flex gap-3 text-xs ${muted}`}>
                  <button
                    type="button"
                    onClick={() =>
                      action(`/api/admin/comments/${c.id}/dismiss-reports`, {
                        method: "POST",
                      })
                    }
                    className={actionBtn}
                  >
                    Dismiss reports
                  </button>
                  {c.status !== "hidden" ? (
                    <button
                      type="button"
                      onClick={() => patchStatus(c.id, "hidden")}
                      className={actionBtn}
                    >
                      Hide
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => del(c.id)}
                    className="text-(--danger) hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Blocked users{blocked.length ? ` (${blocked.length})` : ""}
        </h2>
        {blocked.length === 0 ? (
          <p className={`mt-2 text-sm ${muted}`}>No blocked users.</p>
        ) : (
          <div className="mt-3">
            {blocked.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between border-t border-(--border) py-2"
              >
                <span className="text-sm">{u.display_name ?? "(no name)"}</span>
                <button
                  type="button"
                  onClick={() =>
                    action(`/api/admin/users/${u.id}/block`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ blocked: false }),
                    })
                  }
                  className="text-xs text-green-700 hover:underline dark:text-green-500"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
