import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateCategoryDeletion } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Bulk-delete categories — admin only. Mirrors the single DELETE: posts are NOT
// deleted; the FK nulls their category_id (they become uncategorized).
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const ids = Array.isArray(o.ids)
    ? [...new Set(o.ids.filter((v): v is string => typeof v === "string"))]
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: "No categories selected." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Capture slugs + member post slugs BEFORE delete (the FK nulls category_id
  // afterwards, so their cached pages must be invalidated).
  const [{ data: cats }, { data: members }] = await Promise.all([
    admin.from("categories").select("id, slug").in("id", ids),
    admin.from("posts").select("slug, category_id").in("category_id", ids),
  ]);

  const { error } = await admin.from("categories").delete().in("id", ids);
  if (error) return serverError(error);

  const memberRows = members ?? [];
  for (const c of cats ?? []) {
    const memberSlugs = memberRows
      .filter((m) => m.category_id === c.id)
      .map((m) => m.slug);
    revalidateCategoryDeletion(c.slug, memberSlugs);
  }
  return NextResponse.json({ ok: true });
}
