import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateCategoryDeletion } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

// Delete a category — admin only. Posts in it are NOT deleted; their
// category_id is set to NULL (uncategorized) by the foreign-key constraint.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const supabaseAdmin = createAdminClient();
  // Capture the slug + member post slugs BEFORE deleting: the FK nulls each
  // member's category_id, so their cached post pages (and the category page)
  // need invalidating or they'd show a stale link to the now-404 category.
  const [{ data: cat }, { data: members }] = await Promise.all([
    supabaseAdmin.from("categories").select("slug").eq("id", id).maybeSingle(),
    supabaseAdmin.from("posts").select("slug").eq("category_id", id),
  ]);

  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);
  if (error) {
    return serverError(error);
  }

  revalidateCategoryDeletion(
    (cat as { slug: string } | null)?.slug ?? "",
    ((members ?? []) as { slug: string }[]).map((m) => m.slug),
  );
  return NextResponse.json({ ok: true });
}
