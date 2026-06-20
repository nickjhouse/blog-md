"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_SVG = 100_000;
const MAX_PNG = 150_000;

function PreviewSwatch({
  label,
  bg,
  url,
}: {
  label: string;
  bg: string;
  url: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] px-5 py-4"
        style={{ background: bg }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={16} height={16} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={32} height={32} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={48} height={48} />
      </div>
      <span className="text-xs text-[color:var(--muted)]">{label}</span>
    </div>
  );
}

export function BrandMarkEditor({
  currentUrl,
  isCustom,
}: {
  currentUrl: string;
  isCustom: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(f: File | null) {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    const isSvg = f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg");
    const isPng = f.type === "image/png" || f.name.toLowerCase().endsWith(".png");
    if (!isSvg && !isPng) {
      setError("Choose an SVG or PNG file.");
      return;
    }
    if (isSvg && f.size > MAX_SVG) {
      setError("SVG is too large (max 100 KB).");
      return;
    }
    if (isPng && f.size > MAX_PNG) {
      setError("PNG is too large (max 150 KB).");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/settings/brand", { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Upload failed.");
      return;
    }
    pick(null);
    router.refresh();
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/settings/brand", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Reset failed.");
      return;
    }
    pick(null);
    router.refresh();
  }

  const shown = previewUrl ?? currentUrl;

  return (
    <div className="max-w-xl">
      <p className="text-sm text-[color:var(--muted)]">
        This icon is used for both the browser favicon and the nav logo. Upload an
        SVG (preferred — crisp at any size) or PNG. Use a square-ish viewBox and a
        design that reads on both light and dark backgrounds.
      </p>

      <div className="mt-5 flex flex-wrap gap-4">
        <PreviewSwatch label="On light" bg="#ffffff" url={shown} />
        <PreviewSwatch label="On dark" bg="#0b0a14" url={shown} />
      </div>
      {previewUrl ? (
        <p className="mt-2 text-xs text-[color:var(--accent)]">
          Preview of the selected file — not saved yet.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          {isCustom ? "Showing your uploaded mark." : "Showing the default mark."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/svg+xml,image/png,.svg,.png"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Choose file…
        </button>
        <button
          type="button"
          onClick={upload}
          disabled={!file || busy}
          className="rounded-md bg-[color:var(--button-bg)] px-3 py-1.5 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save icon"}
        </button>
        {isCustom ? (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] disabled:opacity-50"
          >
            Reset to default
          </button>
        ) : null}
      </div>

      {file ? (
        <p className="mt-2 text-xs text-[color:var(--muted)]">Selected: {file.name}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
