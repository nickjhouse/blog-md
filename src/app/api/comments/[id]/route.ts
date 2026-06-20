import { NextResponse, type NextRequest } from "next/server";
import { getViewerContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseJson } from "@/lib/route-guards";
import { filterProfanity } from "@/lib/profanity";
import { getModerationTermsForFilter } from "@/lib/terms";
import {
  COMMENT_MIN_LENGTH,
  COMMENT_MAX_LENGTH,
  COMMENT_EDIT_WINDOW_MS,
} from "@/lib/comments-config";

type Ctx = { params: Promise<{ id: string }> };

// Delete a comment — allowed for the comment's author or an admin.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: comment } = await supabaseAdmin
    .from("comments")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!comment) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (!viewer.isAdmin && comment.author_id !== viewer.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("comments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Hide / unhide a comment — admin only.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const viewer = await getViewerContext();
  if (!viewer?.isAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const o = await parseJson(req);
  const status =
    o.status === "hidden" ? "hidden" : o.status === "visible" ? "visible" : null;
  if (!status) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("comments")
    .update({ status })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Edit a comment's body — the author only, within the edit window, while the
// comment is visible/pending. Re-runs the profanity filter server-side.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const o = await parseJson(req);
  const bodyText = typeof o.body === "string" ? o.body.trim() : "";
  if (bodyText.length < COMMENT_MIN_LENGTH) {
    return NextResponse.json({ error: "Comment is too short." }, { status: 400 });
  }
  if (bodyText.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: "Comment is too long." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: comment } = await supabaseAdmin
    .from("comments")
    .select("author_id, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!comment) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (comment.author_id !== viewer.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (comment.status === "hidden") {
    return NextResponse.json(
      { error: "This comment can’t be edited." },
      { status: 403 },
    );
  }
  const created = new Date(comment.created_at).getTime();
  if (Number.isNaN(created) || Date.now() - created > COMMENT_EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "The edit window for this comment has closed." },
      { status: 403 },
    );
  }

  const terms = await getModerationTermsForFilter();
  const { censored } = filterProfanity(bodyText, terms);
  const editedAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("comments")
    .update({ body: censored, edited_at: editedAt })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, body: censored, edited_at: editedAt });
}
