"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSearch } from "@/components/AdminSearch";
import type { ManagedUser } from "@/lib/users";
import type { UserRole } from "@/lib/supabase/enums";

const ROLES: UserRole[] = ["reader", "author", "admin"];

export function UsersManager({
  users,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        (u.display_name?.toLowerCase().includes(q) ?? false) ||
        u.role.includes(q) ||
        (u.is_blocked && "blocked".includes(q)),
    );
  }, [rows, query]);

  // You can never block yourself, so your row isn't selectable. "Select all"
  // acts on the currently-filtered rows (matches the posts list).
  const selectable = filtered.filter((u) => u.id !== currentUserId);
  const allSelected =
    selectable.length > 0 && selectable.every((u) => selected.has(u.id));

  function toggleOne(id: string) {
    if (id === currentUserId) return;
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
      if (allSelected) selectable.forEach((u) => next.delete(u.id));
      else selectable.forEach((u) => next.add(u.id));
      return next;
    });
  }

  async function changeRole(id: string, role: UserRole) {
    setBusyId(id);
    setError(null);
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, role } : r)));
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not update role.");
      setRows(prev); // revert
      return;
    }
    router.refresh();
  }

  async function runBulk(blocked: boolean) {
    const ids = [...selected].filter((id) => id !== currentUserId);
    if (!ids.length) return;
    if (
      blocked &&
      !confirm(
        `Block ${ids.length} user${ids.length === 1 ? "" : "s"} from commenting?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const prev = rows;
    setRows((rs) =>
      rs.map((r) => (ids.includes(r.id) ? { ...r, is_blocked: blocked } : r)),
    );
    const res = await fetch("/api/admin/users/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, blocked }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not update users.");
      setRows(prev); // revert
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="mt-6">
      {error ? (
        <p className="mb-3 text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search by name or role…"
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4"
            aria-label="Select all users"
          />
          <span className="text-[color:var(--muted)]">
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
        </label>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runBulk(true)}
              disabled={bulkBusy}
              className="rounded-md border border-[color:var(--danger)] px-3 py-1 text-sm text-[color:var(--danger)] disabled:opacity-50"
            >
              Block
            </button>
            <button
              type="button"
              onClick={() => runBulk(false)}
              disabled={bulkBusy}
              className="rounded-md border border-[color:var(--border-strong)] px-3 py-1 text-sm disabled:opacity-50"
            >
              Unblock
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
            No users match “{query}”.
          </p>
        ) : (
          filtered.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 border-t border-[color:var(--border)] py-3"
          >
            <input
              type="checkbox"
              checked={selected.has(u.id)}
              onChange={() => toggleOne(u.id)}
              disabled={u.id === currentUserId}
              className="h-4 w-4 shrink-0 disabled:opacity-40"
              aria-label={`Select ${u.display_name ?? "user"}`}
            />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">
                  {u.display_name ?? "(no name)"}
                  {u.id === currentUserId ? (
                    <span className="text-[color:var(--muted)]"> · you</span>
                  ) : null}
                </div>
                {u.is_blocked ? (
                  <div className="text-xs text-[color:var(--danger)]">blocked</div>
                ) : null}
              </div>
              <select
                value={u.role}
                disabled={busyId === u.id}
                onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                className="shrink-0 rounded-md border border-[color:var(--border)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[color:var(--border-strong)] disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
