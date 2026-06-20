"use client";

import { useEffect, useRef, useState } from "react";
import parse from "html-react-parser";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slug";
import { splitFrontmatter } from "@/lib/frontmatter";
import { MediaPicker } from "@/components/MediaPicker";
import { MarkdownToolbar } from "@/components/MarkdownToolbar";
import { RevisionHistory } from "@/components/RevisionHistory";
import type { RevisionFull } from "@/lib/revisions";
import { formatEdit, type FormatAction } from "@/lib/markdown-format";
import {
  readDraft,
  writeDraft,
  clearDraft,
  sameContent,
  type DraftContent,
  type DraftSnapshot,
} from "@/lib/autosave";
import type { CategoryOption, AdminPostFull } from "@/lib/posts";
import type { SeriesOption } from "@/lib/series";
import type { AuthorOption } from "@/lib/users";

type Props = {
  mode: "create" | "edit";
  categories: CategoryOption[];
  series: SeriesOption[];
  // Provided only to admins (for reassignment); authors never see this.
  authors?: AuthorOption[];
  initial?: AdminPostFull;
};

const inputClass =
  "mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Crop presets passed to the media picker per image slot.
const COVER_CROP = { aspect: 2, outWidth: 1600, title: "Crop cover image (1600×800)" };
const OG_CROP = { aspect: 1200 / 630, outWidth: 1200, title: "Crop social image (1200×630)" };

type PickerTarget = "cover" | "og" | "inline";

export function PostEditor({
  mode,
  categories: initialCategories,
  series: initialSeries,
  authors = [],
  initial,
}: Props) {
  const router = useRouter();
  // Stable for this mount; null for an unsaved new post (local autosave only).
  const postId = initial?.id ?? null;
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState(initialCategories);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugLocked, setSlugLocked] = useState(mode === "edit");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [coverAlt, setCoverAlt] = useState(initial?.cover_alt ?? "");
  const [bodyMd, setBodyMd] = useState(initial?.body_md ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [publishAt, setPublishAt] = useState(toLocalInput(initial?.published_at));

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [series, setSeries] = useState(initialSeries);
  const [seriesId, setSeriesId] = useState(initial?.series_id ?? "");
  const [seriesOrder, setSeriesOrder] = useState<string>(
    initial?.series_order != null ? String(initial.series_order) : "",
  );
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeries, setNewSeries] = useState("");

  // Admin-only author reassignment ("" = default to the creator/current author).
  const [authorId, setAuthorId] = useState(initial?.author_id ?? "");

  // Per-post SEO overrides (all optional; blank = default behavior).
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(
    initial?.seo_description ?? "",
  );
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonical_url ?? "");
  const [ogImage, setOgImage] = useState(initial?.og_image ?? "");
  const [noindex, setNoindex] = useState(initial?.noindex ?? false);
  const [showSeo, setShowSeo] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which image slot the media picker is open for (null = closed).
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  // Autosave: status indicator + a recovered snapshot pending the user's choice.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [restorable, setRestorable] = useState<DraftSnapshot | null>(null);
  // Set when a past revision was loaded into the editor (review-before-save).
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  // Current editor state as a draft snapshot (recomputed each render).
  const draftContent: DraftContent = {
    title,
    slug,
    slugLocked,
    categoryId,
    excerpt,
    coverImage,
    coverAlt,
    bodyMd,
    tags,
    publishAt,
    seriesId,
    seriesOrder,
    authorId,
    seoTitle,
    seoDescription,
    canonicalUrl,
    ogImage,
    noindex,
  };
  const draftJson = JSON.stringify(draftContent);

  // Debounced live preview. Renders in the BROWSER with the exact same converter
  // the server uses on publish (markdownToSafeHtml) — dynamically imported so the
  // markdown pipeline stays out of the editor's initial bundle. Doing it
  // client-side avoids a per-keystroke fetch to a Worker route running the
  // CPU-heavy remark/rehype pipeline, which was tripping the Workers CPU limit
  // (1102) on the free plan. Publish still re-runs this server-side, so
  // sanitization can't be bypassed. The old server route also stamped stored
  // image dimensions; the published post still does — the live preview skips that
  // to stay off the Worker (at worst a small image reflow while drafting).
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const { markdownToSafeHtml } = await import("@/lib/markdown");
        const html = await markdownToSafeHtml(bodyMd);
        if (!cancelled) setPreviewHtml(html);
      } catch {
        if (!cancelled) setPreviewHtml("");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [bodyMd]);

  // On mount: surface a recovered snapshot if it differs from the loaded post.
  useEffect(() => {
    const saved = readDraft(postId);
    if (!saved) return;
    const baseline: DraftContent = {
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      slugLocked: mode === "edit",
      categoryId: initial?.category_id ?? "",
      excerpt: initial?.excerpt ?? "",
      coverImage: initial?.cover_image ?? "",
      coverAlt: initial?.cover_alt ?? "",
      bodyMd: initial?.body_md ?? "",
      tags: initial?.tags ?? [],
      publishAt: toLocalInput(initial?.published_at),
      seriesId: initial?.series_id ?? "",
      seriesOrder:
        initial?.series_order != null ? String(initial.series_order) : "",
      authorId: initial?.author_id ?? "",
      seoTitle: initial?.seo_title ?? "",
      seoDescription: initial?.seo_description ?? "",
      canonicalUrl: initial?.canonical_url ?? "",
      ogImage: initial?.og_image ?? "",
      noindex: initial?.noindex ?? false,
    };
    if (!sameContent(saved, baseline)) setRestorable(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave: always a local snapshot; also a content-only server save
  // when the post exists. Skips the initial run so we don't save unchanged state.
  const firstAutosave = useRef(true);
  useEffect(() => {
    if (firstAutosave.current) {
      firstAutosave.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      const f = JSON.parse(draftJson) as DraftContent;
      writeDraft(postId, { ...f, savedAt: Date.now() });
      if (!postId) {
        setSaveStatus("saved"); // saved locally (new, unsaved post)
        return;
      }
      setSaveStatus("saving");
      const ok = await fetch(`/api/admin/posts/${postId}/autosave`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          excerpt: f.excerpt,
          category_id: f.categoryId,
          body_md: f.bodyMd,
          cover_image: f.coverImage,
          cover_alt: f.coverAlt,
          series_id: f.seriesId,
          series_order: f.seriesOrder,
          seo_title: f.seoTitle,
          seo_description: f.seoDescription,
          canonical_url: f.canonicalUrl,
          og_image: f.ogImage,
          noindex: f.noindex,
        }),
      })
        .then((r) => r.ok)
        .catch(() => false);
      setSaveStatus(ok ? "saved" : "idle");
    }, 1500);
    return () => clearTimeout(handle);
  }, [draftJson, postId]);

  function restoreDraft() {
    if (!restorable) return;
    const d = restorable;
    setTitle(d.title);
    setSlug(d.slug);
    setSlugLocked(d.slugLocked);
    setCategoryId(d.categoryId);
    setExcerpt(d.excerpt);
    setCoverImage(d.coverImage);
    setCoverAlt(d.coverAlt);
    setBodyMd(d.bodyMd);
    setTags(d.tags);
    setPublishAt(d.publishAt);
    setSeriesId(d.seriesId);
    setSeriesOrder(d.seriesOrder);
    setAuthorId(d.authorId);
    setSeoTitle(d.seoTitle);
    setSeoDescription(d.seoDescription);
    setCanonicalUrl(d.canonicalUrl);
    setOgImage(d.ogImage);
    setNoindex(d.noindex);
    setRestorable(null);
  }

  function discardDraft() {
    clearDraft(postId);
    setRestorable(null);
  }

  // Load a past revision's content + metadata into the editor for review. Live
  // state (status, publish time, author) is intentionally left as-is — the user
  // re-publishes via the buttons below. Category/series that no longer exist are
  // dropped so the restored state can't reference a deleted row.
  function restoreRevision(rev: RevisionFull) {
    setTitle(rev.title);
    setSlug(rev.slug);
    setSlugLocked(true);
    setCategoryId(
      categories.some((c) => c.id === rev.category_id)
        ? (rev.category_id ?? "")
        : "",
    );
    setExcerpt(rev.excerpt ?? "");
    setCoverImage(rev.cover_image ?? "");
    setCoverAlt(rev.cover_alt ?? "");
    setBodyMd(rev.body_md);
    setTags(rev.tags);
    setSeriesId(
      series.some((s) => s.id === rev.series_id) ? (rev.series_id ?? "") : "",
    );
    setSeriesOrder(rev.series_order != null ? String(rev.series_order) : "");
    setSeoTitle(rev.seo_title ?? "");
    setSeoDescription(rev.seo_description ?? "");
    setCanonicalUrl(rev.canonical_url ?? "");
    setOgImage(rev.og_image ?? "");
    setNoindex(rev.noindex);
    setRestoredAt(rev.createdAt);
  }

  // Apply a toolbar format action to the body textarea. Uses execCommand so the
  // edit joins the browser's native undo stack; falls back to a state-set if the
  // (deprecated) API is unavailable. Selection is restored afterward.
  function applyFormat(action: FormatAction) {
    const el = bodyRef.current;
    if (!el) return;
    const edit = formatEdit(action, el.value, el.selectionStart, el.selectionEnd);
    el.focus();
    el.setSelectionRange(edit.from, edit.to);
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, edit.text);
    } catch {
      ok = false;
    }
    if (!ok) {
      setBodyMd(el.value.slice(0, edit.from) + edit.text + el.value.slice(edit.to));
    }
    requestAnimationFrame(() => {
      const t = bodyRef.current;
      if (t) {
        t.focus();
        t.setSelectionRange(edit.selStart, edit.selEnd);
      }
    });
  }

  function onBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const action: FormatAction | null =
      k === "b" ? "bold" : k === "i" ? "italic" : k === "k" ? "link" : null;
    if (!action) return;
    e.preventDefault();
    applyFormat(action);
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugLocked) setSlug(slugify(value));
  }

  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    if (!el) {
      setBodyMd((b) => (b ? `${b}\n${text}` : text));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setBodyMd(bodyMd.slice(0, start) + text + bodyMd.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function addTag(raw: string) {
    const name = raw.replace(/,/g, "").trim();
    if (!name) return;
    setTags((prev) =>
      prev.some((t) => t.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, name],
    );
    setTagInput("");
  }

  async function onMarkdownFile(file: File) {
    const raw = await file.text();
    const { frontmatter, body } = splitFrontmatter(raw);
    setBodyMd(body);
    if (frontmatter.title) onTitleChange(frontmatter.title);
    if (frontmatter.excerpt) setExcerpt(frontmatter.excerpt);
    if (frontmatter.category) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === frontmatter.category!.toLowerCase(),
      );
      if (match) setCategoryId(match.id);
    }
    if (frontmatter.cover) setCoverImage(frontmatter.cover);
  }

  // The media picker (pick existing or upload) returns a URL for the open slot.
  function onPick(url: string) {
    if (picker === "cover") setCoverImage(url);
    else if (picker === "og") setOgImage(url);
    else if (picker === "inline") insertAtCursor(`![](${url})`);
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not add category");
      return;
    }
    setCategories((prev) =>
      [...prev, json.category].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCategoryId(json.category.id);
    setNewCategory("");
    setShowNewCategory(false);
  }

  async function addSeries() {
    const title = newSeries.trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not add series");
      return;
    }
    setSeries((prev) =>
      [...prev, json.series].sort((a, b) => a.title.localeCompare(b.title)),
    );
    setSeriesId(json.series.id);
    setNewSeries("");
    setShowNewSeries(false);
  }

  async function save(status: "draft" | "published") {
    setBusy(true);
    setError(null);
    const payload = {
      title,
      slug: slugify(slug || title),
      category_id: categoryId || null,
      excerpt,
      body_md: bodyMd,
      cover_image: coverImage || null,
      cover_alt: coverAlt || null,
      status,
      tags,
      published_at: publishAt ? new Date(publishAt).toISOString() : null,
      series_id: seriesId || null,
      series_order:
        seriesId && seriesOrder.trim() !== "" ? Number(seriesOrder) : null,
      author_id: authorId || null,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      canonical_url: canonicalUrl.trim() || null,
      og_image: ogImage.trim() || null,
      noindex,
    };
    const url =
      mode === "edit" ? `/api/admin/posts/${initial!.id}` : "/api/admin/posts";
    const res = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(json.error ?? "Could not save");
      return;
    }
    // Auto-newsletter feedback: only the failure needs surfacing (the post is
    // saved). Keep them on the editor so they can retry via "Send to newsletter".
    if (json.newsletter === "failed") {
      setBusy(false);
      setError(
        "Published, but the newsletter couldn’t be sent. Open the post and use “Send to newsletter” to retry.",
      );
      return;
    }

    // Persisted now — drop the local snapshot so it won't prompt a restore.
    clearDraft(postId);

    // New draft: keep editing (with server autosave) instead of bouncing to the
    // list. Re-open as /admin/edit/<id> so it remounts in edit mode.
    if (mode === "create" && status === "draft" && json.post?.id) {
      clearDraft(null);
      router.push(`/admin/edit/${json.post.id}`);
      router.refresh();
      return;
    }
    if (mode === "create") clearDraft(null);

    router.push("/admin");
    router.refresh();
  }

  async function remove() {
    if (!initial) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/posts/${initial.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setBusy(false);
      setError(json.error ?? "Could not delete");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-5" suppressHydrationWarning>
      {restorable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-(--accent) bg-(--hover) px-3 py-2 text-sm">
          <span>
            Unsaved changes from{" "}
            {new Date(restorable.savedAt).toLocaleString()} were recovered.
          </span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-md bg-(--button-bg) px-3 py-1 text-sm font-medium text-(--button-fg)"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-md border border-(--border-strong) px-3 py-1 text-sm font-medium hover:bg-(--surface)"
            >
              Discard
            </button>
          </span>
        </div>
      ) : null}

      {restoredAt ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-(--accent) bg-(--hover) px-3 py-2 text-sm">
          <span>
            Loaded the version from{" "}
            {new Date(restoredAt).toLocaleString()}. Review and Save to keep it.
          </span>
          <button
            type="button"
            onClick={() => setRestoredAt(null)}
            className="shrink-0 rounded-md border border-(--border-strong) px-3 py-1 text-sm font-medium hover:bg-(--surface)"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <label className="block text-sm font-medium">
        Title
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={inputClass}
          placeholder="Post title"
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
          placeholder="post-slug"
        />
        <span className="mt-1 block text-xs font-normal text-(--muted)">
          /post/{slugify(slug || title) || "…"}
        </span>
      </label>

      <div className="text-sm font-medium">
        Category
        <div className="mt-1 flex items-center gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewCategory((v) => !v)}
            className="text-sm text-black/60 hover:underline dark:text-white/60"
          >
            + Add new
          </button>
        </div>
        {showNewCategory ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
              className="rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
            />
            <button
              type="button"
              onClick={addCategory}
              disabled={busy}
              className="rounded-md border border-(--border-strong) px-3 py-2 text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : null}
      </div>

      <div className="text-sm font-medium">
        Series
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            className="rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
          >
            <option value="">No series</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {seriesId ? (
            <label className="flex items-center gap-1 text-sm font-normal text-(--muted)">
              Part #
              <input
                type="number"
                min={1}
                value={seriesOrder}
                onChange={(e) => setSeriesOrder(e.target.value)}
                className="w-20 rounded-md border border-(--border) bg-transparent px-2 py-2 text-sm outline-hidden focus:border-(--border-strong)"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => setShowNewSeries((v) => !v)}
            className="text-sm font-normal text-(--muted) hover:underline"
          >
            + Add new
          </button>
        </div>
        {showNewSeries ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newSeries}
              onChange={(e) => setNewSeries(e.target.value)}
              placeholder="New series title"
              className="rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
            />
            <button
              type="button"
              onClick={addSeries}
              disabled={busy}
              className="rounded-md border border-(--border-strong) px-3 py-2 text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : null}
      </div>

      {/* Admin-only: reassign the post's author. */}
      {authors.length > 0 ? (
        <label className="block text-sm font-medium">
          Author
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            className="mt-1 block rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
          >
            <option value="">{mode === "edit" ? "Unchanged" : "Me"}</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name ?? "(no name)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="text-sm font-medium">
        Tags
        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-(--border) px-2 py-2">
          {tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-sm bg-(--hover) px-2 py-0.5 text-xs"
            >
              {t}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                className="text-black/55 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagInput);
              } else if (e.key === "Backspace" && !tagInput && tags.length) {
                setTags((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => addTag(tagInput)}
            placeholder={tags.length ? "" : "Add tags (Enter or comma)"}
            className="flex-1 bg-transparent text-sm outline-hidden"
          />
        </div>
      </div>

      <label className="block text-sm font-medium">
        Excerpt
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Optional — auto-generated from the body if left blank."
        />
      </label>

      <div className="text-sm font-medium">
        Cover image
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPicker("cover")}
            className="rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-normal"
          >
            {coverImage ? "Replace" : "Choose image"}
          </button>
          {coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt="Cover preview"
                width={64}
                height={40}
                loading="lazy"
                decoding="async"
                className="h-10 w-16 rounded-sm object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverImage("")}
                className="text-sm font-normal text-black/60 hover:underline dark:text-white/50"
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
        {coverImage ? (
          <input
            value={coverAlt}
            onChange={(e) => setCoverAlt(e.target.value)}
            placeholder="Cover alt text (describe the image for screen readers)"
            className={`${inputClass} font-normal`}
          />
        ) : null}
      </div>

      <label className="block text-sm font-medium">
        Publish time
        <input
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-(--muted)">
          Leave blank to publish immediately. A future time schedules the post —
          it stays hidden until then.
        </span>
      </label>

      <div className="rounded-md border border-(--border) p-4">
        <button
          type="button"
          onClick={() => setShowSeo((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          <span>SEO &amp; social overrides</span>
          <span className="text-xs font-normal text-(--muted)">
            {showSeo ? "Hide" : "Optional — show"}
          </span>
        </button>
        {showSeo ? (
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium">
              <span className="flex items-center justify-between">
                SEO title
                <span
                  className={`text-xs font-normal ${seoTitle.trim().length > 60 ? "text-(--danger)" : "text-(--muted)"}`}
                >
                  {seoTitle.trim().length}/60
                </span>
              </span>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className={`${inputClass} font-normal`}
                placeholder="Defaults to the post title"
              />
            </label>
            <label className="block text-sm font-medium">
              <span className="flex items-center justify-between">
                Meta description
                <span
                  className={`text-xs font-normal ${seoDescription.trim().length > 160 ? "text-(--danger)" : "text-(--muted)"}`}
                >
                  {seoDescription.trim().length}/160
                </span>
              </span>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                className={`${inputClass} font-normal`}
                placeholder="Defaults to the excerpt"
              />
            </label>
            <label className="block text-sm font-medium">
              Canonical URL
              <input
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                className={`${inputClass} font-normal`}
                placeholder="https://… — only for cross-posted content"
              />
              <span className="mt-1 block text-xs font-normal text-(--muted)">
                Leave blank to use this post’s own URL.
              </span>
            </label>
            <div className="text-sm font-medium">
              Social image (OG)
              <input
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                className={`${inputClass} font-normal`}
                placeholder="Paste an image URL, or upload below"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPicker("og")}
                  className="rounded-md border border-(--border-strong) px-3 py-1.5 text-sm font-normal"
                >
                  {ogImage ? "Replace" : "Choose image"}
                </button>
                {ogImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ogImage}
                      alt="Social image preview"
                      width={64}
                      height={34}
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-16 rounded-sm object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setOgImage("")}
                      className="text-sm font-normal text-black/60 hover:underline dark:text-white/50"
                    >
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
              <span className="mt-1 block text-xs font-normal text-(--muted)">
                Recommended 1200×630. Defaults to the cover image, then a
                generated image.
              </span>
            </div>
            <label className="flex items-start gap-2 text-sm font-normal">
              <input
                type="checkbox"
                checked={noindex}
                onChange={(e) => setNoindex(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded-sm border-(--border-strong)"
              />
              <span>
                Hide from search engines (noindex)
                <span className="mt-0.5 block text-xs text-(--muted)">
                  Adds a robots noindex tag and removes the post from the sitemap.
                </span>
              </span>
            </label>

            {/* Live preview of the effective values (with their fallbacks). */}
            {(() => {
              const effTitle =
                seoTitle.trim() || title.trim() || "Untitled post";
              const effDesc =
                seoDescription.trim() ||
                excerpt.trim() ||
                "No description yet — add an excerpt or meta description.";
              const effPath =
                canonicalUrl.trim() ||
                `/post/${slugify(slug || title) || "…"}`;
              const effImg = ogImage.trim() || coverImage || "";
              return (
                <div className="space-y-3 border-t border-(--border) pt-4">
                  <span className="text-xs font-normal text-(--muted)">
                    Preview
                  </span>
                  {/* Search result */}
                  <div className="rounded-md border border-(--border) p-3">
                    <div className="truncate text-xs text-(--muted)">
                      {effPath}
                    </div>
                    <div className="truncate text-base text-blue-700 dark:text-blue-400">
                      {effTitle}
                    </div>
                    <div className="line-clamp-2 text-xs font-normal text-(--muted)">
                      {effDesc}
                    </div>
                  </div>
                  {/* Social card */}
                  <div className="max-w-sm overflow-hidden rounded-md border border-(--border)">
                    {effImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={effImg}
                        alt="Social preview"
                        className="aspect-[1.91/1] w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-(--hover) text-xs text-(--muted)">
                        Generated image
                      </div>
                    )}
                    <div className="p-2">
                      <div className="truncate text-xs text-(--muted)">
                        {effPath}
                      </div>
                      <div className="truncate text-sm font-medium">
                        {effTitle}
                      </div>
                      <div className="line-clamp-2 text-xs font-normal text-(--muted)">
                        {effDesc}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between border-b border-(--border) pb-2">
          <span className="text-sm font-medium">Body</span>
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => mdInputRef.current?.click()}
              className="text-black/60 hover:underline dark:text-white/60"
            >
              Upload .md
            </button>
            <button
              type="button"
              onClick={() => setPicker("inline")}
              className="text-black/60 hover:underline dark:text-white/60"
            >
              Insert image
            </button>
            {mode === "edit" && postId ? (
              <RevisionHistory
                postId={postId}
                currentBodyMd={bodyMd}
                current={{
                  title,
                  slug,
                  excerpt,
                  tags,
                  category_id: categoryId,
                  series_id: seriesId,
                  series_order: seriesOrder,
                  cover_image: coverImage,
                  cover_alt: coverAlt,
                  seo_title: seoTitle,
                  seo_description: seoDescription,
                  canonical_url: canonicalUrl,
                  og_image: ogImage,
                  noindex,
                }}
                categories={categories}
                series={series}
                onRestore={restoreRevision}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-2 border-b border-(--border) pb-2">
          <MarkdownToolbar onAction={applyFormat} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <textarea
            ref={bodyRef}
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            onKeyDown={onBodyKeyDown}
            rows={20}
            className="w-full rounded-md border border-(--border) bg-transparent px-3 py-2 font-mono text-sm outline-hidden focus:border-(--border-strong)"
            placeholder="Write or paste Markdown here, or upload a .md file."
          />
          <div className="rounded-md border border-(--border) p-4">
            <div className="mb-2 text-xs text-black/55 dark:text-white/40">
              {previewLoading ? "Updating preview…" : "Preview"}
            </div>
            {/* Parsed to a React tree (not innerHTML) so React reconciles
                across keystroke-debounced updates and keeps the existing <img>
                nodes mounted — avoids the reload/blink on every refresh. The
                HTML is already sanitized server-side. */}
            <div className="prose-content">{parse(previewHtml)}</div>
          </div>
        </div>

        <input
          ref={mdInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onMarkdownFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {picker ? (
        <MediaPicker
          crop={
            picker === "cover"
              ? COVER_CROP
              : picker === "og"
                ? OG_CROP
                : undefined
          }
          onSelect={onPick}
          onClose={() => setPicker(null)}
        />
      ) : null}

      {error ? <p className="text-sm text-(--danger)">{error}</p> : null}

      <div className="flex items-center gap-3 border-t border-(--border) pt-4">
        <button
          type="button"
          onClick={() => save("published")}
          disabled={busy}
          className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50 "
        >
          {busy ? "Saving…" : publishAt ? "Schedule / Publish" : "Publish"}
        </button>
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={busy}
          className="rounded-md border border-(--border-strong) px-4 py-2 text-sm disabled:opacity-50"
        >
          Save draft
        </button>
        <span
          className="text-xs text-(--muted)"
          aria-live="polite"
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? postId
                ? "Autosaved"
                : "Saved locally"
              : ""}
        </span>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-sm text-(--danger) hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
