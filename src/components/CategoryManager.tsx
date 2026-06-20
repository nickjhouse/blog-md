"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSearch } from "@/components/AdminSearch";
import type { CategoryWithCounts } from "@/lib/posts";

export function CategoryManager({
  categories,
}: {
  categories: CategoryWithCounts[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  // Creating is the secondary action here (categories are usually added from the
  // post editor), so the form is collapsed behind "+ New" — except when the list
  // is empty, where adding is the only thing to do.
  const [showCreate, setShowCreate] = useState(categories.length === 0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  // "Select all" acts on the currently-filtered rows (matches the posts list).
  const allSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

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
      if (allSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not create category.");
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function remove(cat: CategoryWithCounts) {
    const msg =
      cat.total > 0
        ? `Delete "${cat.name}"? Its ${cat.total} post${cat.total === 1 ? "" : "s"} will become uncategorized (not deleted).`
        : `Delete "${cat.name}"?`;
    if (!confirm(msg)) return;

    setBusyId(cat.id);
    setError(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not delete category.");
      return;
    }
    router.refresh();
  }

  async function runBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} categor${ids.length === 1 ? "y" : "ies"}? Their posts become uncategorized (not deleted).`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/admin/categories/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not delete categories.");
      return;
    }
    setSelected(new Set());
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
            placeholder="New category name"
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
          + New category
        </button>
      )}

      {categories.length === 0 ? (
        <p className="text-(--muted)">No categories yet.</p>
      ) : (
        <>
          <AdminSearch
            value={query}
            onChange={setQuery}
            placeholder="Search categories…"
          />

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4"
                aria-label="Select all categories"
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
                No categories match “{query}”.
              </p>
            ) : (
              filtered.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 border-t border-(--border) py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(cat.id)}
                  onChange={() => toggleOne(cat.id)}
                  className="h-4 w-4 shrink-0"
                  aria-label={`Select ${cat.name}`}
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{cat.name}</div>
                    <div className="mt-0.5 text-xs text-(--muted)">
                      {cat.published} published
                      <span aria-hidden> · </span>
                      {cat.total} total
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(cat)}
                    disabled={busyId === cat.id}
                    className="shrink-0 text-sm text-(--danger) hover:underline disabled:opacity-50"
                  >
                    {busyId === cat.id ? "Deleting…" : "Delete"}
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
