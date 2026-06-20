"use client";

import { useState } from "react";
import { diffLines, diffStat } from "@/lib/diff";
import type { RevisionSummary, RevisionFull } from "@/lib/revisions";
import type { CategoryOption } from "@/lib/posts";
import type { SeriesOption } from "@/lib/series";

// The editor's current metadata, for the field-by-field comparison. Mirrors the
// non-body fields a revision can differ in (raw editor values — strings, with
// "" for empty — matched against the revision's nullable columns).
export type CurrentMeta = {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  category_id: string;
  series_id: string;
  series_order: string;
  cover_image: string;
  cover_alt: string;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  og_image: string;
  noindex: boolean;
};

type FieldChange = { label: string; from: string; to: string };

// Build the list of non-body fields that differ between a revision and the
// editor's current state. IDs are resolved to readable names; empties render as
// "(empty)". Only changed fields are returned.
function metadataChanges(
  rev: RevisionFull,
  cur: CurrentMeta,
  categories: CategoryOption[],
  series: SeriesOption[],
): FieldChange[] {
  const norm = (v: string | null | undefined) => (v ?? "").toString().trim();
  const catName = (id: string | null) =>
    !id
      ? "Uncategorized"
      : (categories.find((c) => c.id === id)?.name ?? "(deleted category)");
  const serName = (id: string | null) =>
    !id
      ? "No series"
      : (series.find((s) => s.id === id)?.title ?? "(deleted series)");

  const rows: { label: string; old: string; now: string }[] = [
    { label: "Title", old: norm(rev.title), now: norm(cur.title) },
    { label: "Slug", old: norm(rev.slug), now: norm(cur.slug) },
    { label: "Excerpt", old: norm(rev.excerpt), now: norm(cur.excerpt) },
    {
      label: "Tags",
      old: [...rev.tags].sort().join(", "),
      now: [...cur.tags].sort().join(", "),
    },
    {
      label: "Category",
      old: catName(rev.category_id),
      now: catName(cur.category_id || null),
    },
    {
      label: "Series",
      old: serName(rev.series_id),
      now: serName(cur.series_id || null),
    },
    {
      label: "Series part",
      old: rev.series_order != null ? String(rev.series_order) : "",
      now: norm(cur.series_order),
    },
    { label: "Cover image", old: norm(rev.cover_image), now: norm(cur.cover_image) },
    { label: "Cover alt", old: norm(rev.cover_alt), now: norm(cur.cover_alt) },
    { label: "SEO title", old: norm(rev.seo_title), now: norm(cur.seo_title) },
    {
      label: "Meta description",
      old: norm(rev.seo_description),
      now: norm(cur.seo_description),
    },
    {
      label: "Canonical URL",
      old: norm(rev.canonical_url),
      now: norm(cur.canonical_url),
    },
    { label: "Social image", old: norm(rev.og_image), now: norm(cur.og_image) },
    {
      label: "Noindex",
      old: rev.noindex ? "on" : "off",
      now: cur.noindex ? "on" : "off",
    },
  ];

  return rows
    .filter((r) => r.old !== r.now)
    .map((r) => ({
      label: r.label,
      from: r.old || "(empty)",
      to: r.now || "(empty)",
    }));
}

// Revision history viewer. Opens a modal listing saved versions; selecting one
// shows what changed since that version: a field-by-field metadata comparison
// plus a unified line diff of the body, both against the editor's current state.
// "Restore" hands the full snapshot back to the editor (load-into-editor — the
// user reviews and Saves to keep it), then closes.
export function RevisionHistory({
  postId,
  currentBodyMd,
  current,
  categories,
  series,
  onRestore,
}: {
  postId: string;
  currentBodyMd: string;
  current: CurrentMeta;
  categories: CategoryOption[];
  series: SeriesOption[];
  onRestore: (rev: RevisionFull) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<RevisionSummary[]>([]);
  const [selected, setSelected] = useState<RevisionFull | null>(null);

  async function openModal() {
    setOpen(true);
    setSelected(null);
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/posts/${postId}/revisions`).catch(
      () => null,
    );
    setLoading(false);
    if (!res || !res.ok) {
      setError("Could not load history.");
      return;
    }
    const json = (await res.json().catch(() => ({}))) as {
      revisions?: RevisionSummary[];
    };
    setList(json.revisions ?? []);
  }

  async function selectRevision(id: string) {
    setError(null);
    setLoading(true);
    const res = await fetch(
      `/api/admin/posts/${postId}/revisions/${id}`,
    ).catch(() => null);
    setLoading(false);
    if (!res || !res.ok) {
      setError("Could not load that version.");
      return;
    }
    const json = (await res.json().catch(() => ({}))) as {
      revision?: RevisionFull;
    };
    if (json.revision) setSelected(json.revision);
  }

  function close() {
    setOpen(false);
    setSelected(null);
  }

  const lines = selected ? diffLines(selected.body_md, currentBodyMd) : [];
  const stat = selected ? diffStat(lines) : { added: 0, removed: 0 };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-black/60 hover:underline dark:text-white/60"
      >
        History
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
              <h2 className="font-serif text-lg font-bold">
                {selected ? "Compare version" : "Revision history"}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-[color:var(--muted)] hover:bg-[color:var(--hover)]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {error ? (
                <p className="px-4 py-6 text-sm text-[color:var(--danger)]">
                  {error}
                </p>
              ) : loading ? (
                <p className="px-4 py-6 text-sm text-[color:var(--muted)]">
                  Loading…
                </p>
              ) : selected ? (
                <div>
                  <MetaChanges
                    changes={metadataChanges(
                      selected,
                      current,
                      categories,
                      series,
                    )}
                  />
                  <div className="border-t border-[color:var(--border)] px-4 py-2 text-xs font-medium text-[color:var(--muted)]">
                    Body
                  </div>
                  <DiffView lines={lines} />
                </div>
              ) : list.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[color:var(--muted)]">
                  No saved versions yet. Each save adds one.
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--border)]">
                  {list.map((r, idx) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => selectRevision(r.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[color:var(--hover)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {r.title || "(untitled)"}
                          </span>
                          <span className="block text-xs text-[color:var(--muted)]">
                            {new Date(r.createdAt).toLocaleString()}
                            {r.editorName ? ` · ${r.editorName}` : ""}
                            {idx === 0 ? " · latest" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-[color:var(--muted)]">
                          Compare →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] px-4 py-3">
                <span className="text-xs text-[color:var(--muted)]">
                  Version from {new Date(selected.createdAt).toLocaleString()} vs.
                  current ·{" "}
                  <span className="text-green-700 dark:text-green-400">
                    +{stat.added}
                  </span>{" "}
                  <span className="text-red-700 dark:text-red-400">
                    −{stat.removed}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 text-sm hover:bg-[color:var(--hover)]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(selected);
                      close();
                    }}
                    className="rounded-md bg-[color:var(--button-bg)] px-3 py-1.5 text-sm font-medium text-[color:var(--button-fg)]"
                  >
                    Restore this version
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MetaChanges({ changes }: { changes: FieldChange[] }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-2 text-xs font-medium text-[color:var(--muted)]">
        Other changes since this version
      </div>
      {changes.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          No metadata changes — only the body differs (if anything).
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {changes.map((c) => (
            <li key={c.label} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{c.label}:</span>
              <span className="text-red-700 line-through dark:text-red-300">
                {c.from}
              </span>
              <span aria-hidden className="text-[color:var(--muted)]">
                →
              </span>
              <span className="text-green-700 dark:text-green-300">{c.to}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiffView({ lines }: { lines: ReturnType<typeof diffLines> }) {
  if (lines.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[color:var(--muted)]">
        This version&apos;s body is identical to the current one.
      </p>
    );
  }
  return (
    <pre className="overflow-x-auto px-2 py-2 font-mono text-xs leading-relaxed">
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            l.type === "add"
              ? "bg-green-500/10 text-green-800 dark:text-green-300"
              : l.type === "del"
                ? "bg-red-500/10 text-red-800 dark:text-red-300"
                : "text-[color:var(--muted)]"
          }
        >
          <span className="select-none pr-2 opacity-60">
            {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
          </span>
          {l.text || " "}
        </div>
      ))}
    </pre>
  );
}
