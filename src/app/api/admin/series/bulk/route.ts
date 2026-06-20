import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateSeries } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Bulk-delete series — admin only. Mirrors the single DELETE: member posts are
// NOT deleted; the FK nulls their series_id (they leave the series).
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const ids = Array.isArray(o.ids)
    ? [...new Set(o.ids.filter((v): v is string => typeof v === "string"))]
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: "No series selected." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Capture series slugs + member post slugs BEFORE delete (FK nulls series_id;
  // each member's SeriesNav and the old /series/<slug> URL need refreshing).
  const [{ data: seriesRows }, { data: members }] = await Promise.all([
    admin.from("series").select("slug").in("id", ids),
    admin.from("posts").select("slug").in("series_id", ids),
  ]);

  const { error } = await admin.from("series").delete().in("id", ids);
  if (error) return serverError(error);

  const slugs = (seriesRows ?? []).map((s) => s.slug);
  const memberPostSlugs = (members ?? []).map((m) => m.slug);
  revalidateSeries({ slugs, memberPostSlugs });
  return NextResponse.json({ ok: true });
}
