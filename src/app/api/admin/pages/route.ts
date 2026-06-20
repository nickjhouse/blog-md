import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToSafeHtml } from "@/lib/markdown";
import { parsePageInput } from "@/lib/pages";
import { revalidatePage } from "@/lib/revalidate";
import { mapPgError } from "@/lib/api-error";

// Create a static page. Admin only.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const parsed = parsePageInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;
  const bodyHtml = await markdownToSafeHtml(input.body_md);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pages")
    .insert({
      slug: input.slug,
      title: input.title,
      body_md: input.body_md,
      body_html: bodyHtml,
      enabled: input.enabled,
      show_in_footer: input.show_in_footer,
      seo_description: input.seo_description,
    })
    .select("id, slug")
    .single();
  if (error) {
    return mapPgError(error, "A page with that slug already exists.");
  }
  // Revalidate the new page's URL + the chrome (footer) on every cached page.
  revalidatePage(input.slug);
  return NextResponse.json({ page: data });
}
