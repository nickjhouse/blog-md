"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PageListItem } from "@/lib/pages";

// Admin Pages list: the built-in Contact page (toggle only — it's a form, not
// editable content) plus admin-managed content pages with quick enable / footer
// toggles, edit, and delete.
export function PagesAdmin({
  pages,
  contactEnabled,
}: {
  pages: PageListItem[];
  contactEnabled: boolean;
}) {
  const router = useRouter();
  const [contact, setContact] = useState(contactEnabled);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleContact(next: boolean) {
    setContact(next);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_enabled: next }),
    }).catch(() => {});
    router.refresh();
  }

  async function patchPage(
    id: string,
    patch: { enabled?: boolean; show_in_footer?: boolean },
  ) {
    setBusyId(id);
    await fetch(`/api/admin/pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    setBusyId(id);
    await fetch(`/api/admin/pages/${id}`, { method: "DELETE" }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Built-in pages */}
      <div>
        <h2 className="text-sm font-semibold text-(--muted)">
          Built-in
        </h2>
        <div className="mt-2 flex items-center justify-between rounded-md border border-(--border) px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Contact</div>
            <div className="text-xs text-(--muted)">
              /contact — the contact form (content isn’t editable here)
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={contact}
              onChange={(e) => toggleContact(e.target.checked)}
            />
            Enabled
          </label>
        </div>
      </div>

      {/* Content pages */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--muted)">
            Content pages
          </h2>
          <Link
            href="/admin/pages/new"
            className="rounded-md bg-(--button-bg) px-3 py-1.5 text-sm font-medium text-(--button-fg)"
          >
            New page
          </Link>
        </div>

        {pages.length === 0 ? (
          <p className="mt-3 text-sm text-(--muted)">
            No content pages yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-(--border) rounded-md border border-(--border)">
            {pages.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/pages/${p.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="text-xs text-(--muted)">
                    /{p.slug}
                    {!p.enabled ? " · disabled" : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      disabled={busyId === p.id}
                      onChange={(e) =>
                        patchPage(p.id, { enabled: e.target.checked })
                      }
                    />
                    Enabled
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.showInFooter}
                      disabled={busyId === p.id}
                      onChange={(e) =>
                        patchPage(p.id, { show_in_footer: e.target.checked })
                      }
                    />
                    Footer
                  </label>
                  <Link
                    href={`/admin/pages/${p.id}`}
                    className="text-(--muted) hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={busyId === p.id}
                    className="text-(--danger) hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
