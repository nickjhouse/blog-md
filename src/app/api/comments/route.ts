import { NextResponse, type NextRequest } from "next/server";
import { getViewerContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterProfanity } from "@/lib/profanity";
import { getModerationTermsForFilter } from "@/lib/terms";
import { getSettings } from "@/lib/settings";
import { notifyAdminOfComment, notifyCommentReply } from "@/lib/email";
import { getCommentsForPost, getBlockedAuthorIds } from "@/lib/comments";
import { parseJson } from "@/lib/route-guards";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 5000;
const MIN_LENGTH = 2;

// The comment thread for a post, plus the per-user context the client needs to
// render affordances. Per-user (RLS-gated list + viewer roles) → never cached.
// Lets the post page render with NO comments/viewer data, so it's cache-safe.
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "Missing post." }, { status: 400 });
  }
  try {
    const viewer = await getViewerContext();
    // RLS via the viewer's cookie returns exactly what the page used to render
    // (visible to all; hidden/pending to admins).
    const comments = await getCommentsForPost(postId);
    const blockedAuthorIds =
      viewer?.isAdmin && comments.length
        ? await getBlockedAuthorIds(comments.map((c) => c.author_id))
        : [];
    return NextResponse.json(
      {
        comments,
        blockedAuthorIds,
        viewer: viewer
          ? {
              userId: viewer.userId,
              displayName: viewer.displayName,
              isAdmin: viewer.isAdmin,
              isBlocked: viewer.isBlocked,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    // Return a clean 500 JSON (consistent with /api/posts) rather than an
    // unhandled throw; keep no-store since this is a per-user response.
    console.error("[comments] GET failed:", e);
    return NextResponse.json(
      { error: "Could not load comments." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function countLinks(text: string): number {
  // Count each URL-like token once. A bare `https?://|www.` alternation would
  // double-count `https://www.x.com` (it matches both the scheme and the `www.`);
  // consuming the rest of the token with `\S*` makes the whole URL one match.
  const matches = text.match(/(?:https?:\/\/|www\.)\S*/gi);
  return matches ? matches.length : 0;
}

// Create a comment. The ONLY path to insert a comment — enforces sign-in,
// not-blocked, anti-spam (honeypot, rate limit, link cap, min length, duplicate),
// and the profanity filter (masking) server-side.
export async function POST(req: NextRequest) {
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json({ error: "Please sign in to comment." }, { status: 401 });
  }
  if (viewer.isBlocked) {
    return NextResponse.json(
      { error: "Your account is not allowed to comment." },
      { status: 403 },
    );
  }
  // No anonymous comments: a username must be set first (e.g. fresh OAuth users).
  if (!viewer.displayName?.trim()) {
    return NextResponse.json(
      { error: "Choose a username before commenting." },
      { status: 403 },
    );
  }

  const o = await parseJson(req);

  // Honeypot: a hidden field real users never fill. If present, pretend success
  // (so bots don't learn) but drop the comment.
  if (typeof o.website === "string" && o.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const postId = typeof o.post_id === "string" ? o.post_id : null;
  const bodyText = typeof o.body === "string" ? o.body.trim() : "";
  const parentId = typeof o.parent_id === "string" && o.parent_id ? o.parent_id : null;

  if (!postId) {
    return NextResponse.json({ error: "Missing post." }, { status: 400 });
  }
  if (bodyText.length < MIN_LENGTH) {
    return NextResponse.json({ error: "Comment is too short." }, { status: 400 });
  }
  if (bodyText.length > MAX_LENGTH) {
    return NextResponse.json({ error: "Comment is too long." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const settings = await getSettings();

  if (countLinks(bodyText) > settings.max_links_per_comment) {
    return NextResponse.json(
      { error: "Too many links in that comment." },
      { status: 400 },
    );
  }

  // Rate limit (tunable).
  if (settings.rate_limit_seconds > 0) {
    const since = new Date(
      Date.now() - settings.rate_limit_seconds * 1000,
    ).toISOString();
    const { count } = await supabaseAdmin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", viewer.userId)
      .gte("created_at", since);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "You’re commenting too fast — wait a few seconds." },
        { status: 429 },
      );
    }
  }

  // Duplicate: reject if it matches this user's most recent comment.
  const { data: last } = await supabaseAdmin
    .from("comments")
    .select("body")
    .eq("author_id", viewer.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.body?.trim() === bodyText) {
    return NextResponse.json(
      { error: "You already posted that." },
      { status: 400 },
    );
  }

  // Post must exist and be published.
  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id, status, title, slug")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "published") {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  // Threaded reply: parent must be a top-level, visible comment on this post.
  let parentAuthorId: string | null = null;
  if (parentId) {
    const { data: parent } = await supabaseAdmin
      .from("comments")
      .select("id, post_id, parent_id, status, author_id")
      .eq("id", parentId)
      .maybeSingle();
    if (
      !parent ||
      parent.post_id !== postId ||
      parent.parent_id !== null ||
      parent.status !== "visible"
    ) {
      return NextResponse.json(
        { error: "Can’t reply to that comment." },
        { status: 400 },
      );
    }
    parentAuthorId = parent.author_id;
  }

  const terms = await getModerationTermsForFilter();
  const { censored } = filterProfanity(bodyText, terms);
  const pending = settings.require_comment_approval;

  const { error } = await supabaseAdmin.from("comments").insert({
    post_id: postId,
    author_id: viewer.userId,
    body: censored,
    status: pending ? "pending" : "visible",
    parent_id: parentId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (settings.notify_on_comment) {
    await notifyAdminOfComment({
      postTitle: post.title,
      postSlug: post.slug,
      authorName: viewer.displayName ?? "Someone",
      body: censored,
      pending,
    });
  }

  // Notify the parent comment's author of a reply (opt-in, and only once the
  // reply is actually visible — i.e. not held for approval).
  if (parentId && !pending && parentAuthorId && parentAuthorId !== viewer.userId) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("notify_on_reply")
      .eq("id", parentAuthorId)
      .maybeSingle();
    if (prof?.notify_on_reply) {
      const { data: parentUser } =
        await supabaseAdmin.auth.admin.getUserById(parentAuthorId);
      const toEmail = parentUser?.user?.email ?? null;
      if (toEmail) {
        await notifyCommentReply({
          to: toEmail,
          replierName: viewer.displayName ?? "Someone",
          postTitle: post.title,
          postSlug: post.slug,
          body: censored,
        });
      }
    }
  }

  return NextResponse.json(
    { ok: true, pending },
    { headers: { "Cache-Control": "no-store" } },
  );
}
