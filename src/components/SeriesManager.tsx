"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSearch } from "@/components/AdminSearch";
import type { SeriesWithCounts } from "@/lib/series";

export function SeriesManager({ series }: { series: SeriesWithCounts[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  // Creating is the secondary action (series are usually added from the post
  // editor), so collapse the form behind "+ New" unless the list is empty.
  const [showCreate, setShowCreate] = useState(series.length === 0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return series;
    return series.filter((s) => s.title.toLowerCase().includes(q));
  }, [series, query]);

  // "Select all" acts on the currently-filtered rows (matches the posts list).
  const allSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

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
      if (allSelected) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function create() {
    const t = newTitle.trim();
    if (!t) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    setCreating(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not create series.");
      return;
    }
    setNewTitle("");
    router.refresh();
  }

  async function remove(s: SeriesWithCounts) {
    const msg =
      s.total > 0
        ? `Delete "${s.title}"? Its ${s.total} post${s.total === 1 ? "" : "s"} will be removed from the series (not deleted).`
        : `Delete "${s.title}"?`;
    if (!confirm(msg)) return;

    setBusyId(s.id);
    setError(null);
    const res = await fetch(`/api/admin/series/${s.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not delete series.");
      return;
    }
    router.refresh();
  }

  async function runBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} series? Their posts are removed from the series (not deleted).`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/admin/series/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not delete series.");
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  async function rename(id: string) {
    const t = title.trim();
    if (!t) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/series/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not rename series.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="mt-6">
      {error ? (
        <p className="mb-3 text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="mb-4 flex items-center gap-2"
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New series title"
            className="flex-1 rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
          />
          <button
            type="submit"
            disabled={creating || !newTitle.trim()}
            className="shrink-0 rounded-md border border-[color:var(--border-strong)] px-3 py-2 text-sm disabled:opacity-50"
          >
            {creating ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewTitle("");
            }}
            className="shrink-0 text-sm text-[color:var(--muted)] hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mb-4 text-sm font-medium text-[color:var(--accent)] hover:underline"
        >
          + New series
        </button>
      )}

      {series.length === 0 ? (
        <p className="text-[color:var(--muted)]">
          No series yet. Add one above, or from the post editor.
        </p>
      ) : (
        <>
          <AdminSearch
            value={query}
            onChange={setQuery}
            placeholder="Search series…"
          />

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4"
                aria-label="Select all series"
              />
              <span className="text-[color:var(--muted)]">
                {selected.size > 0 ? `${selected.size} selected` : "Select all"}
              </span>
            </label>
            {selected.size > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runBulkDelete}
                  disabled={bulkBusy}
                  className="rounded-md border border-[color:var(--danger)] px-3 py-1 text-sm text-[color:var(--danger)] disabled:opacity-50"
                >
                  {bulkBusy ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  disabled={bulkBusy}
                  className="text-sm text-[color:var(--muted)] hover:underline disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            {filtered.length === 0 ? (
              <p className="py-6 text-sm text-[color:var(--muted)]">
                No series match “{query}”.
              </p>
            ) : (
              filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border-t border-[color:var(--border)] py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleOne(s.id)}
                  className="h-4 w-4 shrink-0"
                  aria-label={`Select ${s.title}`}
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {editingId === s.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[color:var(--border-strong)]"
                        />
                        <button
                          type="button"
                          onClick={() => rename(s.id)}
                          disabled={busyId === s.id}
                          className="text-sm text-[color:var(--accent)] hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-sm text-[color:var(--muted)] hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium">{s.title}</div>
                        <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                          {s.published} published
                          <span aria-hidden> · </span>
                          {s.total} total
                        </div>
                      </>
                    )}
                  </div>
                  {editingId === s.id ? null : (
                    <div className="flex shrink-0 gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(s.id);
                          setTitle(s.title);
                        }}
                        className="text-[color:var(--muted)] hover:underline"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s)}
                        disabled={busyId === s.id}
                        className="text-[color:var(--danger)] hover:underline disabled:opacity-50"
                      >
                        {busyId === s.id ? "…" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
