"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSearch } from "@/components/AdminSearch";
import type { TagWithCounts } from "@/lib/posts";

export function TagManager({ tags }: { tags: TagWithCounts[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  // Tags are usually created by typing them on a post; this lets you pre-create
  // one here. Collapsed behind "+ New" unless the list is empty.
  const [showCreate, setShowCreate] = useState(tags.length === 0);

  // Unused count is over ALL tags (prune ignores the filter); the list + select
  // operate on the filtered set, matching the posts list.
  const unusedCount = tags.filter((t) => t.total === 0).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, query]);
  const allSelected =
    filtered.length > 0 && filtered.every((t) => selected.has(t.id));

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
      if (allSelected) filtered.forEach((t) => next.delete(t.id));
      else filtered.forEach((t) => next.add(t.id));
      return next;
    });
  }

  async function remove(tag: TagWithCounts) {
    const msg =
      tag.total > 0
        ? `Delete "${tag.name}"? It will be removed from its ${tag.total} post${tag.total === 1 ? "" : "s"} (posts aren't deleted).`
        : `Delete unused tag "${tag.name}"?`;
    if (!confirm(msg)) return;

    setBusyId(tag.id);
    setError(null);
    const res = await fetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not delete tag.");
      return;
    }
    router.refresh();
  }

  async function runBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} tag${ids.length === 1 ? "" : "s"}? They'll be removed from their posts (posts aren't deleted).`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/admin/tags/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not delete tags.");
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not create tag.");
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function pruneUnused() {
    if (
      !confirm(`Remove all ${unusedCount} unused tag${unusedCount === 1 ? "" : "s"}?`)
    ) {
      return;
    }
    setPruning(true);
    setError(null);
    const res = await fetch("/api/admin/tags/prune", { method: "POST" });
    setPruning(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not remove unused tags.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6">
      {error ? (
        <p className="mb-3 text-sm text-(--danger)">{error}</p>
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
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New tag name"
            className="flex-1 rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="shrink-0 rounded-md border border-(--border-strong) px-3 py-2 text-sm disabled:opacity-50"
          >
            {creating ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
            className="shrink-0 text-sm text-(--muted) hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mb-4 text-sm font-medium text-(--accent) hover:underline"
        >
          + New tag
        </button>
      )}

      {tags.length === 0 ? (
        <p className="text-(--muted)">
          No tags yet. Add one above, or they’re created when you tag a post.
        </p>
      ) : (
        <>
      {unusedCount > 0 ? (
        <div className="mb-3 flex items-center justify-between gap-4 rounded-md border border-(--border) px-3 py-2 text-sm">
          <span className="text-(--muted)">
            {unusedCount} unused tag{unusedCount === 1 ? "" : "s"} (no posts).
          </span>
          <button
            type="button"
            onClick={pruneUnused}
            disabled={pruning}
            className="shrink-0 font-medium text-(--danger) hover:underline disabled:opacity-50"
          >
            {pruning ? "Removing…" : "Remove all unused"}
          </button>
        </div>
      ) : null}

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search tags…"
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4"
            aria-label="Select all tags"
          />
          <span className="text-(--muted)">
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
        </label>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runBulkDelete}
              disabled={bulkBusy}
              className="rounded-md border border-(--danger) px-3 py-1 text-sm text-(--danger) disabled:opacity-50"
            >
              {bulkBusy ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
              className="text-sm text-(--muted) hover:underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <p className="py-6 text-sm text-(--muted)">
            No tags match “{query}”.
          </p>
        ) : (
          filtered.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center gap-3 border-t border-(--border) py-3"
        >
          <input
            type="checkbox"
            checked={selected.has(tag.id)}
            onChange={() => toggleOne(tag.id)}
            className="h-4 w-4 shrink-0"
            aria-label={`Select ${tag.name}`}
          />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium">{tag.name}</div>
              <div className="mt-0.5 text-xs text-(--muted)">
                {tag.published} published
                <span aria-hidden> · </span>
                {tag.total} total
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(tag)}
              disabled={busyId === tag.id}
              className="shrink-0 text-sm text-(--danger) hover:underline disabled:opacity-50"
            >
              {busyId === tag.id ? "Deleting…" : "Delete"}
            </button>
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
