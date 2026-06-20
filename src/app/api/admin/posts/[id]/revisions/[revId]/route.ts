import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, assertPostOwnership } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRevision } from "@/lib/revisions";

// Per-user GET (reads the viewer's cookie) → never cache.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; revId: string }> };

// A single revision (for the diff view + restore). Same ownership gate as the
// list; getRevision also verifies the revision belongs to this post.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, revId } = await params;
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const ownership = assertPostOwnership(post, me);
  if (ownership) return ownership;

  const revision = await getRevision(id, revId);
  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }
  return NextResponse.json({ revision });
}
