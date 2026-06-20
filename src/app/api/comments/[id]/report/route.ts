import { NextResponse, type NextRequest } from "next/server";
import { getViewerContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseJson } from "@/lib/route-guards";

type Ctx = { params: Promise<{ id: string }> };

// A signed-in, non-blocked reader flags a comment. Reports are written with the
// secret key (no public access to the reports table) and surface in the
// moderation dashboard. Re-reporting the same comment is a no-op.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json({ error: "Please sign in to report." }, { status: 401 });
  }
  if (viewer.isBlocked) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const o = await parseJson(req);
  const reason =
    typeof o.reason === "string" && o.reason.trim()
      ? o.reason.trim().slice(0, 500)
      : null;

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!comment) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (comment.author_id === viewer.userId) {
    return NextResponse.json(
      { error: "You can’t report your own comment." },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("comment_reports")
    .insert({ comment_id: id, reporter_id: viewer.userId, reason });
  if (error && error.code !== "23505") {
    // 23505 = already reported by this user; treat as success.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
