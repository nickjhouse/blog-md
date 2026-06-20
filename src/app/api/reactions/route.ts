import { NextResponse, type NextRequest } from "next/server";
import { getViewerContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseJson } from "@/lib/route-guards";
import { isLive } from "@/lib/published";

export const dynamic = "force-dynamic";

// Live like count + the viewer's own like state for a post. Never cached
// (no-store): the post page bakes in a server-rendered count that goes stale
// under ISR, so the client refreshes it from here on mount — for signed-out
// readers too, hence the count is returned regardless of sign-in state.
export async function GET(req: NextRequest) {
  const noStore = { "Cache-Control": "no-store" } as const;
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ liked: false, count: 0 }, { headers: noStore });
  }

  const supabase = createAdminClient();

  // Only expose counts for a real, live post (mirrors the POST guard) — never
  // leak reaction data for drafts, scheduled (future) posts, or unknown ids.
  const { data: post } = await supabase
    .from("posts")
    .select("status, published_at")
    .eq("id", postId)
    .maybeSingle();
  if (!isLive(post)) {
    return NextResponse.json({ liked: false, count: 0 }, { headers: noStore });
  }

  const { count } = await supabase
    .from("reactions")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);

  // Per-user liked state only when signed in (the count is global).
  let liked = false;
  const viewer = await getViewerContext();
  if (viewer) {
    const { data } = await supabase
      .from("reactions")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", viewer.userId)
      .maybeSingle();
    liked = !!data;
  }

  return NextResponse.json({ liked, count: count ?? 0 }, { headers: noStore });
}

// Toggle the signed-in viewer's like on a post. Returns the new state + count.
export async function POST(req: NextRequest) {
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json(
      { error: "Please sign in to react." },
      { status: 401 },
    );
  }
  if (viewer.isBlocked) {
    return NextResponse.json(
      { error: "Your account is not allowed to react." },
      { status: 403 },
    );
  }

  const o = await parseJson(req);
  const postId = typeof o.post_id === "string" ? o.post_id : null;
  if (!postId) {
    return NextResponse.json({ error: "Missing post." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Only allow reacting to a real, live post (not a draft or future-scheduled).
  const { data: post } = await supabase
    .from("posts")
    .select("status, published_at")
    .eq("id", postId)
    .maybeSingle();
  if (!isLive(post)) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewer.userId)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", viewer.userId);
    if (error) {
      return NextResponse.json(
        { error: "Could not update your reaction." },
        { status: 500 },
      );
    }
    liked = false;
  } else {
    const { error } = await supabase
      .from("reactions")
      .insert({ post_id: postId, user_id: viewer.userId });
    // 23505 = unique violation: a concurrent request already inserted the like,
    // so the desired end state (liked) is satisfied — treat as success.
    if (error && error.code !== "23505") {
      return NextResponse.json(
        { error: "Could not update your reaction." },
        { status: 500 },
      );
    }
    liked = true;
  }

  const { count } = await supabase
    .from("reactions")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);

  return NextResponse.json(
    { liked, count: count ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
