import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { bulkDeleteMedia, mediaUsageMany } from "@/lib/media";

export const dynamic = "force-dynamic";

// Bulk-delete from the Media Library. Admin-only, matching the single DELETE on
// ../route.ts. Body: { paths: string[], force?: boolean }. Without `force`, it
// refuses if any path is still referenced by a post (409 + the in-use paths);
// the UI sends force=true after the user confirms deleting in-use images.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const raw = (o as { paths?: unknown }).paths;
  const paths = Array.isArray(raw)
    ? raw.filter(
        (p): p is string => typeof p === "string" && p.trim().length > 0,
      )
    : [];

  if (!paths.length) {
    return NextResponse.json({ error: "No paths provided" }, { status: 400 });
  }
  if (paths.length > 200) {
    return NextResponse.json(
      { error: "Too many at once (max 200)" },
      { status: 400 },
    );
  }

  if (o.force !== true) {
    const inUse = await mediaUsageMany(paths);
    if (inUse.length) {
      return NextResponse.json(
        { error: "in_use", paths: inUse, used: inUse.length },
        { status: 409 },
      );
    }
  }

  await bulkDeleteMedia(paths);
  return NextResponse.json({ ok: true, deleted: paths.length });
}
