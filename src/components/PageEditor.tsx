"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slug";
import type { Page } from "@/lib/pages";

const inputClass =
  "mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]";

// Editor for an admin-managed static page. Markdown body with live preview
// (reuses the post preview endpoint). Used for both create and edit.
export function PageEditor({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Page;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugLocked, setSlugLocked] = useState(mode === "edit");
  const [bodyMd, setBodyMd] = useState(initial?.bodyMd ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [showInFooter, setShowInFooter] = useState(
    initial?.showInFooter ?? false,
  );
  const [seoDescription, setSeoDescription] = useState(
    initial?.seoDescription ?? "",
  );

  const [previewHtml, setPreviewHtml] = useState(initial?.bodyHtml ?? "");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      const res = await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_md: bodyMd }),
      });
      const json = await res.json().catch(() => ({}));
      setPreviewLoading(false);
      if (res.ok) setPreviewHtml(json.html ?? "");
    }, 500);
    return () => clearTimeout(handle);
  }, [bodyMd]);

  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugLocked) setSlug(slugify(v));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const payload = {
      title,
      slug: slugify(slug || title),
      body_md: bodyMd,
      enabled,
      show_in_footer: showInFooter,
      seo_description: seoDescription.trim() || null,
    };
    const url =
      mode === "edit" ? `/api/admin/pages/${initial!.id}` : "/api/admin/pages";
    const res = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save");
      return;
    }
    setSaved(true);
    if (mode === "create" && json.page?.id) {
      router.push(`/admin/pages/${json.page.id}`);
      router.refresh();
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!initial) return;
    if (!confirm("Delete this page? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/pages/${initial.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setBusy(false);
      setError(json.error ?? "Could not delete");
      return;
    }
    router.push("/admin/pages");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-5">
      <label className="block text-sm font-medium">
        Title
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={inputClass}
          placeholder="Page title"
        />
      </label>

      <label className="block text-sm font-medium">
        Slug
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugLocked(true);
          }}
          className={inputClass}
          placeholder="about"
        />
        <span className="mt-1 block text-xs font-normal text-[color:var(--muted)]">
          /{slugify(slug || title) || "…"}
        </span>
      </label>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled (public + in sitemap)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInFooter}
            onChange={(e) => setShowInFooter(e.target.checked)}
          />
          Show link in footer
        </label>
      </div>

      <label className="block text-sm font-medium">
        <span className="flex items-center justify-between">
          Meta description{" "}
          <span className="font-normal text-[color:var(--muted)]">
            (optional, for SEO)
          </span>
        </span>
        <textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          rows={2}
          maxLength={300}
          className={`${inputClass} font-normal`}
          placeholder="A short summary shown in search results."
        />
      </label>

      <div>
        <div className="border-b border-[color:var(--border)] pb-2 text-sm font-medium">
          Body
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={18}
            className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--border-strong)]"
            placeholder="Write the page content in Markdown."
          />
          <div className="rounded-md border border-[color:var(--border)] p-4">
            <div className="mb-2 text-xs text-black/55 dark:text-white/40">
              {previewLoading ? "Updating preview…" : "Preview"}
            </div>
            <div
              className="prose-content"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-[color:var(--success)]">Saved.</p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-[color:var(--border)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save page"}
        </button>
        {mode === "edit" ? (
          <a
            href={`/admin/pages/${initial!.id}/preview`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[color:var(--muted)] hover:underline"
          >
            Preview ↗
          </a>
        ) : null}
        {mode === "edit" && enabled ? (
          <a
            href={`/${slugify(slug || title)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[color:var(--muted)] hover:underline"
          >
            View live ↗
          </a>
        ) : null}
        {mode === "edit" ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-sm text-[color:var(--danger)] hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
