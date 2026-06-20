import { NextResponse } from "next/server";
import { getSignedInUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";
import { SITE_SLUG } from "@/lib/site.config";

// Self-serve data export: the signed-in user downloads their own data as JSON.
// Authorized by the session only — it can ONLY ever return the caller's rows.
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSignedInUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = createAdminClient();

  const [authRes, profileRes, commentsRes, reactionsRes, bookmarksRes, postsRes] =
    await Promise.all([
      db.auth.admin.getUserById(userId),
      db
        .from("profiles")
        .select("id, display_name, role, is_blocked, notify_on_reply, created_at")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("comments")
        .select("id, post_id, body, status, created_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: true }),
      db
        .from("reactions")
        .select("post_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      db
        .from("bookmarks")
        .select("post_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      db
        .from("posts")
        .select("id, title, slug, status, created_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: true }),
    ]);

  // Don't hand the user a silently-partial export: if any section failed, fail
  // the whole request rather than omitting data they'd assume is complete.
  const errors = [
    authRes.error,
    profileRes.error,
    commentsRes.error,
    reactionsRes.error,
    bookmarksRes.error,
    postsRes.error,
  ].filter(Boolean);
  if (errors.length) {
    return serverError(errors, "Could not assemble your export. Please try again.");
  }

  const profile = profileRes.data;
  const comments = commentsRes.data ?? [];
  const reactions = reactionsRes.data ?? [];
  const bookmarks = bookmarksRes.data ?? [];
  const authoredPosts = postsRes.data ?? [];

  // Resolve referenced post titles/slugs in one query so the export is readable.
  const ids = new Set<string>();
  comments.forEach((c) => ids.add(c.post_id));
  reactions.forEach((r) => ids.add(r.post_id));
  bookmarks.forEach((b) => ids.add(b.post_id));
  const postMap = new Map<string, { title: string; slug: string }>();
  if (ids.size > 0) {
    const { data: refs } = await db
      .from("posts")
      .select("id, title, slug")
      .in("id", [...ids]);
    (refs ?? []).forEach((p) =>
      postMap.set(p.id, { title: p.title, slug: p.slug }),
    );
  }
  const withPost = <T extends { post_id: string }>(rows: T[]) =>
    rows.map((r) => ({ ...r, post: postMap.get(r.post_id) ?? null }));

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: userId,
      email: authRes.data?.user?.email ?? null,
      created_at: authRes.data?.user?.created_at ?? null,
      display_name: profile?.display_name ?? null,
      role: profile?.role ?? null,
      is_blocked: profile?.is_blocked ?? null,
      notify_on_reply: profile?.notify_on_reply ?? null,
    },
    comments: withPost(comments),
    reactions: withPost(reactions),
    bookmarks: withPost(bookmarks),
    authored_posts: authoredPosts,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${SITE_SLUG}-my-data.json"`,
      "Cache-Control": "no-store",
    },
  });
}
