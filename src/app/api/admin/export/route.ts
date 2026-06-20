import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createZip, type ZipEntry } from "@/lib/zip";
import { getSiteIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_md: string;
  cover_image: string | null;
  cover_alt: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category: { name: string } | { name: string }[] | null;
};

// Always double-quote + escape so values with colons/quotes/newlines stay valid.
function y(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function toMarkdown(p: PostRow, tags: string[]): string {
  const cat = Array.isArray(p.category) ? p.category[0] : p.category;
  const fm: string[] = ["---", `title: ${y(p.title)}`, `slug: ${y(p.slug)}`];
  if (cat?.name) fm.push(`category: ${y(cat.name)}`);
  if (p.excerpt) fm.push(`excerpt: ${y(p.excerpt)}`);
  if (p.cover_image) fm.push(`cover: ${y(p.cover_image)}`);
  if (p.cover_alt) fm.push(`cover_alt: ${y(p.cover_alt)}`);
  if (tags.length) fm.push(`tags: [${tags.map(y).join(", ")}]`);
  fm.push(`status: ${y(p.status)}`);
  if (p.published_at) fm.push(`published_at: ${y(p.published_at)}`);
  fm.push(`created_at: ${y(p.created_at)}`);
  fm.push(`updated_at: ${y(p.updated_at)}`);
  fm.push("---", "");
  return `${fm.join("\n")}\n${p.body_md}\n`;
}

// Admin-only: download every post as a .md file (with front-matter) in a zip.
// Reached only via browser navigation (the admin Export link), so on an
// unauthorized hit we redirect to /admin rather than returning raw JSON.
export async function GET(request: Request) {
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const supabase = createAdminClient();
  const [postsRes, tagsRes] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, slug, excerpt, body_md, cover_image, cover_alt, status, published_at, created_at, updated_at, category:categories(name)",
      )
      .order("created_at", { ascending: true }),
    supabase.from("post_tags").select("post_id, tag:tags(name)"),
  ]);

  const posts = postsRes.data ?? [];
  const tagRows = tagsRes.data ?? [];

  const tagsByPost = new Map<string, string[]>();
  for (const r of tagRows) {
    const t = Array.isArray(r.tag) ? r.tag[0] : r.tag;
    if (!t?.name) continue;
    const list = tagsByPost.get(r.post_id) ?? [];
    list.push(t.name);
    tagsByPost.set(r.post_id, list);
  }

  // Guard against duplicate filenames if two posts ever share a slug.
  const used = new Set<string>();
  const entries: ZipEntry[] = posts.map((p) => {
    let name = `${p.slug || p.id}.md`;
    let n = 2;
    while (used.has(name)) name = `${p.slug || p.id}-${n++}.md`;
    used.add(name);
    return { name, content: toMarkdown(p, tagsByPost.get(p.id) ?? []) };
  });

  const zip = createZip(entries);
  // Copy into a plain ArrayBuffer so it's an unambiguous BlobPart.
  const buf = new ArrayBuffer(zip.length);
  new Uint8Array(buf).set(zip);
  const date = new Date().toISOString().slice(0, 10);
  const { slug } = await getSiteIdentity();
  return new Response(new Blob([buf], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
