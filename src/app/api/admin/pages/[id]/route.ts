import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToSafeHtml } from "@/lib/markdown";
import { parsePageInput } from "@/lib/pages";
import { revalidatePage } from "@/lib/revalidate";
import { mapPgError, serverError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

// Update a static page. Admin only.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const parsed = parsePageInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;
  const bodyHtml = await markdownToSafeHtml(input.body_md);

  const admin = createAdminClient();
  // Former slug (for invalidating the old URL on a rename).
  const { data: prior } = await admin
    .from("pages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const formerSlug = (prior as { slug: string } | null)?.slug ?? null;
  const { data, error } = await admin
    .from("pages")
    .update({
      slug: input.slug,
      title: input.title,
      body_md: input.body_md,
      body_html: bodyHtml,
      enabled: input.enabled,
      show_in_footer: input.show_in_footer,
      seo_description: input.seo_description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, slug")
    .single();
  if (error) {
    return mapPgError(error, "A page with that slug already exists.");
  }
  // Content/title/footer/enabled may have changed → refresh the page URL (+ the
  // old URL on a rename) and the chrome on every cached page.
  revalidatePage(data.slug, formerSlug);
  return NextResponse.json({ page: data });
}

// Quick flag toggles (enabled / show_in_footer) from the list, without a full
// editor round-trip. Admin only.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const o = await parseJson(req);
  const patch: { enabled?: boolean; show_in_footer?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof o.enabled === "boolean") patch.enabled = o.enabled;
  if (typeof o.show_in_footer === "boolean") patch.show_in_footer = o.show_in_footer;

  const admin = createAdminClient();
  const { error } = await admin.from("pages").update(patch).eq("id", id);
  if (error) {
    return serverError(error);
  }
  // enabled/footer toggles affect the page's own URL (disable → 404) and the
  // footer on every cached page — refresh both.
  const { data: row } = await admin
    .from("pages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  revalidatePage((row as { slug: string } | null)?.slug ?? "");
  return NextResponse.json({ ok: true });
}

// Delete a static page. Admin only.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = createAdminClient();
  // Capture the slug before deleting so we can drop its now-404 URL from cache.
  const { data: row } = await admin
    .from("pages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const { error } = await admin.from("pages").delete().eq("id", id);
  if (error) {
    return serverError(error);
  }
  // Removed page → drop its now-404 URL + its footer link everywhere.
  revalidatePage((row as { slug: string } | null)?.slug ?? "");
  return NextResponse.json({ ok: true });
}
