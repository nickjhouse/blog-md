import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, assertPostOwnership } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRevisions } from "@/lib/revisions";

// Per-user GET (reads the viewer's cookie) → never cache.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// List a post's revision history (newest first). Authors may view only their
// own posts' history; admins any.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
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

  const revisions = await listRevisions(id);
  return NextResponse.json({ revisions });
}
