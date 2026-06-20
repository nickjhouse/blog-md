"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/lib/settings";
import type { ModerationTerm } from "@/lib/terms";

const muted = "text-black/60 dark:text-white/60";
const numInput =
  "w-20 rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[color:var(--border-strong)]";

// Comment behavior settings + the custom filtered-words list. Posts to the
// shared /api/admin/settings and /api/admin/terms routes.
export function CommentsSettings({
  settings,
  terms,
}: {
  settings: SiteSettings;
  terms: ModerationTerm[];
}) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [newTerm, setNewTerm] = useState("");
  const [newTermKind, setNewTermKind] = useState<"block" | "allow">("block");
  const [error, setError] = useState<string | null>(null);

  async function persist(patch: Partial<SiteSettings>) {
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    router.refresh();
  }

  async function setSetting(patch: Partial<SiteSettings>) {
    setS((prev) => ({ ...prev, ...patch }));
    await persist(patch);
  }

  async function addTerm() {
    const term = newTerm.trim();
    if (!term) return;
    setError(null);
    const res = await fetch("/api/admin/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, kind: newTermKind }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not add term.");
      return;
    }
    setNewTerm("");
    router.refresh();
  }

  async function removeTerm(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/terms/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not remove term.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}

      <section>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.require_comment_approval}
            onChange={(e) =>
              setSetting({ require_comment_approval: e.target.checked })
            }
          />
          Hold new comments for approval before they show
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.notify_on_comment}
            onChange={(e) => setSetting({ notify_on_comment: e.target.checked })}
          />
          Email me when a new comment is posted
        </label>
        <div className="mt-3 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            Rate limit (seconds)
            <input
              type="number"
              min={0}
              value={s.rate_limit_seconds}
              onChange={(e) =>
                setS((p) => ({ ...p, rate_limit_seconds: Number(e.target.value) }))
              }
              onBlur={() => persist({ rate_limit_seconds: s.rate_limit_seconds })}
              className={numInput}
            />
          </label>
          <label className="flex items-center gap-2">
            Max links per comment
            <input
              type="number"
              min={0}
              value={s.max_links_per_comment}
              onChange={(e) =>
                setS((p) => ({
                  ...p,
                  max_links_per_comment: Number(e.target.value),
                }))
              }
              onBlur={() =>
                persist({ max_links_per_comment: s.max_links_per_comment })
              }
              className={numInput}
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Filtered words</h2>
        <p className={`mt-1 text-sm ${muted}`}>
          Custom terms layered on the built-in profanity filter. “Block” masks a
          word in new comments; “allow” exempts it.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
            placeholder="word or phrase"
            className="rounded-md border border-[color:var(--border)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[color:var(--border-strong)]"
          />
          <select
            value={newTermKind}
            onChange={(e) =>
              setNewTermKind(e.target.value === "allow" ? "allow" : "block")
            }
            className="rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="block">block</option>
            <option value="allow">allow</option>
          </select>
          <button
            type="button"
            onClick={addTerm}
            className="rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 text-sm"
          >
            Add
          </button>
        </div>
        {terms.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {terms.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1 rounded bg-[color:var(--hover)] px-2 py-0.5 text-xs"
              >
                {t.term}
                <span className={muted}>· {t.kind}</span>
                <button
                  type="button"
                  onClick={() => removeTerm(t.id)}
                  aria-label={`Remove ${t.term}`}
                  className="text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
