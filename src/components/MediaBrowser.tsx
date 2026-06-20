"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { CoverCropper } from "@/components/CoverCropper";
import { uploadImage } from "@/lib/upload-image";

export type MediaItem = {
  path: string;
  url: string;
  size_bytes: number | null;
  content_type: string | null;
  alt: string | null;
  created_at: string | null;
  used: number;
};

type UsedInPost = { id: string; title: string; slug: string };

type CropPreset = { aspect: number; outWidth: number; title: string };

type Props = {
  mode: "pick" | "manage";
  onSelect?: (url: string) => void;
  // When set, uploads are cropped to this preset first (cover / OG).
  crop?: CropPreset;
};

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Shared media grid. `pick` mode selects an image (and can upload); `manage`
// mode (the /admin/media page) adds delete + an unused-only filter.
export function MediaBrowser({ mode, onSelect, crop }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [usageModal, setUsageModal] = useState<{
    path: string;
    posts: UsedInPost[] | null;
  } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPage = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/media?limit=60&offset=${nextOffset}`);
    const json = (await res.json().catch(() => ({}))) as {
      items?: MediaItem[];
      hasMore?: boolean;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn’t load media.");
      return;
    }
    setItems((prev) =>
      nextOffset === 0 ? (json.items ?? []) : [...prev, ...(json.items ?? [])],
    );
    if (nextOffset === 0) setSelected(new Set());
    setOffset(nextOffset);
    setHasMore(!!json.hasMore);
  }, []);

  const loadOrphans = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/media?orphans=1`);
    const json = (await res.json().catch(() => ({}))) as {
      items?: MediaItem[];
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn’t load media.");
      return;
    }
    setItems(json.items ?? []);
    setSelected(new Set());
    setHasMore(false);
  }, []);

  useEffect(() => {
    if (orphansOnly) loadOrphans();
    else loadPage(0);
  }, [orphansOnly, loadOrphans, loadPage]);

  // Upload one file and prepend it to the grid; returns an error message or null.
  async function putOne(file: File): Promise<string | null> {
    try {
      const { url, path } = await uploadImage(file);
      setItems((prev) => [
        {
          path,
          url,
          size_bytes: file.size,
          content_type: file.type,
          alt: null,
          created_at: new Date().toISOString(),
          used: 0,
        },
        ...prev,
      ]);
      if (mode === "pick") onSelect?.(url);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Upload failed.";
    }
  }

  // Single-file path: pick mode and the cropped cover/OG result.
  async function doUpload(file: File) {
    setUploading(true);
    setError(null);
    const err = await putOne(file);
    if (err) setError(err);
    setUploading(false);
  }

  // Multi-file path (Media Library only). Sequential so the canvas downscale in
  // uploadImage() doesn't jank the tab, with a running count and a summary of
  // any failures / skipped non-images.
  async function uploadMany(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const skipped = files.length - images.length;
    setError(null);
    setNotice(null);
    if (images.length === 0) {
      if (skipped > 0)
        setNotice(
          `Skipped ${skipped} non-image file${skipped === 1 ? "" : "s"}.`,
        );
      return;
    }
    setBatch({ done: 0, total: images.length });
    let failed = 0;
    for (let i = 0; i < images.length; i++) {
      if (await putOne(images[i])) failed += 1;
      setBatch({ done: i + 1, total: images.length });
    }
    setBatch(null);
    if (failed > 0)
      setError(
        `${failed} of ${images.length} upload${images.length === 1 ? "" : "s"} failed.`,
      );
    if (skipped > 0)
      setNotice(`Skipped ${skipped} non-image file${skipped === 1 ? "" : "s"}.`);
  }

  function onFile(file: File) {
    if (crop) setCropFile(file);
    else doUpload(file);
  }

  // Drag-and-drop, manage mode only (pick/crop stay single-file via the button).
  function onDragOver(e: DragEvent) {
    if (mode !== "manage" || batch) return;
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave(e: DragEvent) {
    if (mode !== "manage") return;
    // Ignore leaves that just move onto a child element.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  }
  function onDrop(e: DragEvent) {
    if (mode !== "manage") return;
    e.preventDefault();
    setDragOver(false);
    if (batch) return; // a batch is already running
    const files = e.dataTransfer.files;
    if (files && files.length) uploadMany(Array.from(files));
  }

  async function showUsage(item: MediaItem) {
    setUsageModal({ path: item.path, posts: null });
    const res = await fetch(
      `/api/admin/media?usage=${encodeURIComponent(item.path)}`,
    );
    const json = (await res.json().catch(() => ({}))) as {
      posts?: UsedInPost[];
    };
    setUsageModal({ path: item.path, posts: json.posts ?? [] });
  }

  async function remove(item: MediaItem) {
    const force = item.used > 0;
    if (force) {
      if (
        !window.confirm(
          `This image is used in ${item.used} post${item.used === 1 ? "" : "s"}. Delete anyway? Those posts will show a broken image.`,
        )
      ) {
        return;
      }
    } else if (!window.confirm("Delete this image? This can’t be undone.")) {
      return;
    }
    setError(null);
    const res = await fetch(
      `/api/admin/media?path=${encodeURIComponent(item.path)}${force ? "&force=1" : ""}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Couldn’t delete.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.path !== item.path));
  }

  const allSelected =
    items.length > 0 && items.every((i) => selected.has(i.path));

  function toggleOne(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) items.forEach((i) => next.delete(i.path));
      else items.forEach((i) => next.add(i.path));
      return next;
    });
  }

  // Bulk delete the selected paths. Mirrors single delete: warn (and force) if
  // any selected image is still used in a post.
  async function runBulkDelete() {
    const paths = [...selected];
    if (!paths.length) return;
    const inUse = items.filter(
      (i) => selected.has(i.path) && i.used > 0,
    ).length;
    const msg =
      inUse > 0
        ? `Delete ${paths.length} image${paths.length === 1 ? "" : "s"}? ${inUse} ${inUse === 1 ? "is" : "are"} used in posts and will show a broken image. This can’t be undone.`
        : `Delete ${paths.length} image${paths.length === 1 ? "" : "s"}? This can’t be undone.`;
    if (!window.confirm(msg)) return;

    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/admin/media/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, force: inUse > 0 }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        json.error === "in_use"
          ? "Some images are used in posts — refresh and try again."
          : (json.error ?? "Couldn’t delete."),
      );
      return;
    }
    setItems((prev) => prev.filter((i) => !selected.has(i.path)));
    setSelected(new Set());
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-lg transition ${
        dragOver ? "ring-2 ring-[color:var(--accent)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || batch !== null}
          className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
        >
          {batch
            ? `Uploading ${batch.done} of ${batch.total}…`
            : uploading
              ? "Uploading…"
              : mode === "manage"
                ? "Upload images"
                : "Upload image"}
        </button>
        {mode === "manage" ? (
          <>
            <span className="text-sm text-[color:var(--muted)]">
              or drag &amp; drop
            </span>
            <label className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={orphansOnly}
                onChange={(e) => setOrphansOnly(e.target.checked)}
                className="h-4 w-4"
              />
              Show unused only
            </label>
            <button
              type="button"
              onClick={() => {
                setSelecting((v) => !v);
                setSelected(new Set());
              }}
              className="rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 text-sm"
            >
              {selecting ? "Cancel" : "Bulk delete"}
            </button>
          </>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple={mode === "manage"}
          hidden
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length) {
              if (mode === "manage") uploadMany(Array.from(files));
              else onFile(files[0]);
            }
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 text-sm text-[color:var(--muted)]">{notice}</p>
      ) : null}

      {mode === "manage" && selecting && items.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4"
              aria-label="Select all images"
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
                {bulkBusy ? "Deleting…" : `Delete ${selected.size}`}
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
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.path}
            className={`relative overflow-hidden rounded-md border ${
              mode === "manage" && selecting && selected.has(item.path)
                ? "border-[color:var(--accent)] ring-1 ring-[color:var(--accent)]"
                : "border-[color:var(--border)]"
            }`}
          >
            {mode === "manage" && selecting ? (
              <label className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-black/55">
                <input
                  type="checkbox"
                  checked={selected.has(item.path)}
                  onChange={() => toggleOne(item.path)}
                  className="h-4 w-4"
                  aria-label={`Select ${item.path}`}
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (mode === "pick") onSelect?.(item.url);
                else if (selecting) toggleOne(item.path);
              }}
              className={`block w-full ${
                mode === "pick" || selecting
                  ? "cursor-pointer hover:opacity-90"
                  : "cursor-default"
              }`}
              aria-label={
                mode === "pick"
                  ? "Select image"
                  : selecting
                    ? "Toggle selection"
                    : undefined
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt ?? ""}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full bg-[color:var(--hover)] object-cover"
              />
            </button>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-[color:var(--muted)]">
              <span className="truncate">
                {formatBytes(item.size_bytes)}
                {" · "}
                {item.used > 0 ? (
                  mode === "manage" ? (
                    <button
                      type="button"
                      onClick={() => showUsage(item)}
                      className="underline hover:text-[color:var(--foreground)]"
                    >
                      used {item.used}×
                    </button>
                  ) : (
                    `used ${item.used}×`
                  )
                ) : (
                  "unused"
                )}
              </span>
              {mode === "manage" ? (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="shrink-0 text-[color:var(--danger)] hover:underline"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          {orphansOnly ? "No unused images." : "No images yet."}
        </p>
      ) : null}

      {hasMore && !orphansOnly ? (
        <button
          type="button"
          onClick={() => loadPage(offset + 60)}
          disabled={loading}
          className="mt-4 rounded-md border border-[color:var(--border-strong)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Load more
        </button>
      ) : null}

      {usageModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Used in posts"
          onClick={() => setUsageModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Used in</h2>
              <button
                type="button"
                onClick={() => setUsageModal(null)}
                className="text-sm text-[color:var(--muted)] hover:underline"
              >
                Close
              </button>
            </div>
            {usageModal.posts === null ? (
              <p className="mt-3 text-sm text-[color:var(--muted)]">Loading…</p>
            ) : usageModal.posts.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Not referenced by any post.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {usageModal.posts.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/admin/edit/${p.id}`}
                      className="underline hover:text-[color:var(--foreground)]"
                    >
                      {p.title || p.slug}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {cropFile && crop ? (
        <CoverCropper
          file={cropFile}
          aspect={crop.aspect}
          outWidth={crop.outWidth}
          title={crop.title}
          fileSuffix="img"
          onCancel={() => setCropFile(null)}
          onConfirm={(cropped) => {
            setCropFile(null);
            doUpload(cropped);
          }}
        />
      ) : null}
    </div>
  );
}
