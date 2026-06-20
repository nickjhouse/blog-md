import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, requireAdmin, parseJson } from "@/lib/route-guards";
import {
  listMedia,
  recordMedia,
  deleteMedia,
  findOrphans,
  mediaUsage,
  mediaUsageDetail,
} from "@/lib/media";

export const dynamic = "force-dynamic";

// Media Library API. Contributor-gated (authors + admins). The bucket is the
// source of truth; this exposes list / record / delete / orphan-scan over it.

export async function GET(req: NextRequest) {
  const gate = await requireContributor();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const usagePath = searchParams.get("usage");
  if (usagePath) {
    return NextResponse.json({ posts: await mediaUsageDetail(usagePath) });
  }
  if (searchParams.get("orphans") === "1") {
    return NextResponse.json({ items: await findOrphans() });
  }
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const { items, hasMore } = await listMedia({ limit, offset });
  return NextResponse.json({ items, hasMore });
}

export async function POST(req: NextRequest) {
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const o = await parseJson(req);
  const path = typeof o.path === "string" ? o.path.trim() : "";
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  await recordMedia({
    path,
    size_bytes: typeof o.size_bytes === "number" ? o.size_bytes : null,
    content_type: typeof o.content_type === "string" ? o.content_type : null,
    width: typeof o.width === "number" ? o.width : null,
    height: typeof o.height === "number" ? o.height : null,
    alt: typeof o.alt === "string" ? o.alt : null,
    uploaded_by: me.userId,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  // Admin-only: deleting from the shared media library is a management action.
  // (GET/POST stay contributor-level so the editor's image picker works.)
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  // Guard against deleting an in-use image unless explicitly forced.
  if (searchParams.get("force") !== "1") {
    const used = await mediaUsage(path);
    if (used > 0) {
      return NextResponse.json(
        { error: "in_use", used },
        { status: 409 },
      );
    }
  }
  await deleteMedia(path);
  return NextResponse.json({ ok: true });
}
