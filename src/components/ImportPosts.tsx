"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  name: string;
  status: "created" | "skipped" | "error";
  message?: string;
  slug?: string;
};

export function ImportPosts() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [asDraft, setAsDraft] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function onImport() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const payload = await Promise.all(
        files.map(async (f) => ({ name: f.name, content: await f.text() })),
      );
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payload, asDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }
      setResults(data.results ?? []);
      router.refresh();
    } catch {
      setError("Couldn’t read or upload the files.");
    } finally {
      setBusy(false);
    }
  }

  const color: Record<Result["status"], string> = {
    created: "text-[color:var(--success)]",
    skipped: "text-[color:var(--muted)]",
    error: "text-[color:var(--danger)]",
  };

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-[color:var(--muted)]">
        Upload markdown files (the format produced by Export). Each becomes a
        post. Files whose slug already exists are skipped, so re-importing is
        safe.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple
        onChange={(e) => {
          setFiles(Array.from(e.target.files ?? []));
          setResults(null);
        }}
        className="block text-sm"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={asDraft}
          onChange={(e) => setAsDraft(e.target.checked)}
          className="h-4 w-4 rounded border-[color:var(--border-strong)]"
        />
        Import as drafts (recommended — review before publishing)
      </label>

      <button
        type="button"
        onClick={onImport}
        disabled={busy || files.length === 0}
        className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
      >
        {busy
          ? "Importing…"
          : `Import ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
      </button>

      {error ? (
        <p className="text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}

      {results ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm">
          <p className="font-medium">
            {results.filter((r) => r.status === "created").length} created ·{" "}
            {results.filter((r) => r.status === "skipped").length} skipped ·{" "}
            {results.filter((r) => r.status === "error").length} errored
          </p>
          <ul className="mt-2 space-y-1">
            {results.map((r, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate">{r.name}</span>
                <span className={color[r.status]}>
                  {r.status}
                  {r.message ? ` — ${r.message}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
