"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { AdminSearch } from "@/components/AdminSearch";
import type { AdminPostRow } from "@/lib/posts";

type BulkAction = "publish" | "draft" | "delete";

export function AdminPostsList({ posts }: { posts: AdminPostRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.category?.name.toLowerCase().includes(q) ?? false) ||
        p.status.includes(q),
    );
  }, [posts, query]);

  const allSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  }

  async function runBulk(action: BulkAction) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "delete") {
      if (
        !window.confirm(
          `Delete ${ids.length} post${ids.length === 1 ? "" : "s"}? This can’t be undone.`,
        )
      ) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/posts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Bulk action failed.");
      return;
    }
    // Publish can partially fail per-row — surface that instead of looking clean.
    const json = (await res.json().catch(() => ({}))) as { failed?: string[] };
    if (json.failed && json.failed.length > 0) {
      const n = json.failed.length;
      setError(`${n} post${n === 1 ? "" : "s"} could not be published — check the logs.`);
    }
    setSelected(new Set());
    router.refresh();
  }

  if (posts.length === 0) {
    return (
      <p className="mt-6 text-[color:var(--muted)]">
        No posts yet. Create your first one.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search by title, category, or status…"
      />

      {filtered.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4"
              aria-label="Select all posts"
            />
            <span className="text-[color:var(--muted)]">
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
          </label>

          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runBulk("publish")}
                disabled={busy}
                className="rounded-md border border-[color:var(--border-strong)] px-3 py-1 text-sm disabled:opacity-50"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => runBulk("draft")}
                disabled={busy}
                className="rounded-md border border-[color:var(--border-strong)] px-3 py-1 text-sm disabled:opacity-50"
              >
                Move to draft
              </button>
              <button
                type="button"
                onClick={() => runBulk("delete")}
                disabled={busy}
                className="rounded-md border border-[color:var(--danger)] px-3 py-1 text-sm text-[color:var(--danger)] disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={busy}
                className="text-sm text-[color:var(--muted)] hover:underline disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}

      <div className="mt-4">
        {filtered.length === 0 ? (
          <p className="py-6 text-sm text-[color:var(--muted)]">
            No posts match “{query}”.
          </p>
        ) : (
          filtered.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-3 border-t border-[color:var(--border)] py-3"
            >
              <input
                type="checkbox"
                checked={selected.has(post.id)}
                onChange={() => toggleOne(post.id)}
                className="h-4 w-4 shrink-0"
                aria-label={`Select ${post.title}`}
              />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/edit/${post.id}`}
                    className="font-medium hover:underline"
                  >
                    {post.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {(() => {
                      const scheduled =
                        post.status === "published" &&
                        !!post.published_at &&
                        new Date(post.published_at).getTime() > Date.now();
                      const label = scheduled ? "scheduled" : post.status;
                      const color =
                        label === "published"
                          ? "text-green-700 dark:text-green-500"
                          : label === "scheduled"
                            ? "text-blue-700 dark:text-blue-400"
                            : "text-amber-700 dark:text-amber-500";
                      return <span className={color}>{label}</span>;
                    })()}
                    <span aria-hidden> · </span>
                    {post.category?.name ?? "Uncategorized"}
                    <span aria-hidden> · </span>
                    {formatDate(post.published_at ?? post.updated_at)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  {post.status === "published" &&
                  post.published_at &&
                  new Date(post.published_at).getTime() <= Date.now() ? (
                    <Link
                      href={`/post/${post.slug}`}
                      className="text-[color:var(--muted)] hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                  <Link href={`/admin/edit/${post.id}`} className="hover:underline">
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
