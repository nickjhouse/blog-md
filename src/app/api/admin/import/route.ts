import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToSafeHtml } from "@/lib/markdown";
import { deriveExcerpt, readingMinutes } from "@/lib/content";
import { syncPostTags } from "@/lib/admin-tags";
import { parseImportMarkdown } from "@/lib/import-md";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const MAX_FILES = 500;
const MAX_CONTENT = 500_000; // 500 KB per file

type FileInput = { name: string; content: string };
type Result = {
  name: string;
  status: "created" | "skipped" | "error";
  message?: string;
  slug?: string;
};

// Bulk-create posts from uploaded markdown files (the export format). Admin-only.
// Skips files whose slug already exists so re-running is safe.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const asDraft = o.asDraft !== false; // default: import as drafts
  const files = (Array.isArray(o.files) ? o.files : []).filter(
    (f): f is FileInput =>
      !!f &&
      typeof (f as FileInput).name === "string" &&
      typeof (f as FileInput).content === "string",
  );

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES}).` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Preload categories into a lowercase-name -> id map; create missing ones.
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name");
  const catMap = new Map<string, string>();
  for (const c of (cats ?? []) as { id: string; name: string }[]) {
    catMap.set(c.name.toLowerCase(), c.id);
  }

  async function resolveCategory(name: string): Promise<string | null> {
    const key = name.toLowerCase();
    const existing = catMap.get(key);
    if (existing) return existing;
    const slug = slugify(name);
    if (!slug) return null;
    const { data, error } = await supabase
      .from("categories")
      .insert({ name, slug })
      .select("id")
      .single();
    if (error) {
      // Unique-conflict race — re-fetch by slug.
      const { data: re } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (re?.id) {
        catMap.set(key, re.id);
        return re.id;
      }
      return null;
    }
    catMap.set(key, data.id);
    return data.id;
  }

  const results: Result[] = [];

  for (const file of files) {
    const baseName = file.name.replace(/\.(md|markdown)$/i, "");
    try {
      if (file.content.length > MAX_CONTENT) {
        results.push({ name: file.name, status: "error", message: "Too large" });
        continue;
      }
      const { frontmatter, body } = parseImportMarkdown(file.content);
      const title = (frontmatter.title || baseName || "Untitled").trim();
      const slug = slugify(frontmatter.slug || title || baseName);
      if (!slug) {
        results.push({ name: file.name, status: "error", message: "No slug" });
        continue;
      }

      // Skip if a post with this slug already exists.
      const { data: existing } = await supabase
        .from("posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) {
        results.push({
          name: file.name,
          status: "skipped",
          message: "Slug already exists",
          slug,
        });
        continue;
      }

      const status =
        asDraft || frontmatter.status !== "published" ? "draft" : "published";
      const categoryId = frontmatter.category
        ? await resolveCategory(frontmatter.category)
        : null;
      const bodyHtml = await markdownToSafeHtml(body);

      const { data: inserted, error } = await supabase
        .from("posts")
        .insert({
          title,
          slug,
          category_id: categoryId,
          excerpt: frontmatter.excerpt?.trim() || deriveExcerpt(body),
          body_md: body,
          body_html: bodyHtml,
          cover_image: frontmatter.cover || null,
          cover_alt: frontmatter.cover_alt?.trim() || null,
          status,
          reading_minutes: readingMinutes(body),
          published_at:
            status === "published"
              ? frontmatter.published_at || new Date().toISOString()
              : null,
        })
        .select("id")
        .single();

      if (error || !inserted) {
        results.push({
          name: file.name,
          status: "error",
          message: error?.message ?? "Insert failed",
        });
        continue;
      }

      if (frontmatter.tags?.length) {
        await syncPostTags(supabase, inserted.id, frontmatter.tags);
      }
      results.push({ name: file.name, status: "created", slug });
    } catch (e) {
      results.push({
        name: file.name,
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errored = results.filter((r) => r.status === "error").length;
  return NextResponse.json({ results, created, skipped, errored });
}
