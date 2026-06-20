import { NextResponse, type NextRequest } from "next/server";
import { getViewerContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseJson } from "@/lib/route-guards";

export const dynamic = "force-dynamic";

// The viewer's own bookmark state for a post (per-user → never cached). Client
// buttons call this on mount so the post page render carries no per-user data.
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId");
  const viewer = await getViewerContext();
  if (!viewer || !postId) {
    return NextResponse.json(
      { bookmarked: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  return NextResponse.json(
    { bookmarked: !!data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Toggle the signed-in viewer's bookmark on a post. Returns the new state.
export async function POST(req: NextRequest) {
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json(
      { error: "Please sign in to save posts." },
      { status: 401 },
    );
  }

  const o = await parseJson(req);
  const postId = typeof o.post_id === "string" ? o.post_id : null;
  if (!postId) {
    return NextResponse.json({ error: "Missing post." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "published") {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewer.userId)
    .maybeSingle();

  let bookmarked: boolean;
  if (existing) {
    await supabase
      .from("bookmarks")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", viewer.userId);
    bookmarked = false;
  } else {
    await supabase
      .from("bookmarks")
      .insert({ post_id: postId, user_id: viewer.userId });
    bookmarked = true;
  }

  return NextResponse.json(
    { bookmarked },
    { headers: { "Cache-Control": "no-store" } },
  );
}
