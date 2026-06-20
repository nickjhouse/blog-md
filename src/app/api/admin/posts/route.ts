import { NextResponse, type NextRequest } from "next/server";
import { requireContributor } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePostInput } from "@/lib/post-input";
import { buildPostRow, captureRevisionFromInput } from "@/lib/post-write";
import { syncPostTags } from "@/lib/admin-tags";
import { getSettings } from "@/lib/settings";
import { maybeAutoSendNewsletter } from "@/lib/newsletter";
import { revalidatePost } from "@/lib/revalidate";
import { mapPgError } from "@/lib/api-error";

// Create a post. Contributors (authors + admins) only; converts markdown ->
// sanitized HTML server-side and writes with the secret key.
export async function POST(req: NextRequest) {
  const me = await requireContributor();
  if (me instanceof NextResponse) return me;

  const parsed = parsePostInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;
  // Authors always own what they create; only admins may assign another author.
  const authorId = me.isAdmin && input.author_id ? input.author_id : me.userId;

  const publishedAt =
    input.status === "published"
      ? (input.published_at ?? new Date().toISOString())
      : null;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert(
      await buildPostRow(input, { authorId, publishedAt, admin: supabaseAdmin }),
    )
    .select("id, slug")
    .single();

  if (error) {
    return mapPgError(error, "A post with that slug already exists.");
  }

  await syncPostTags(supabaseAdmin, data.id, input.tags);

  // First revision (v1) — best-effort; never blocks the create.
  await captureRevisionFromInput(supabaseAdmin, input, {
    postId: data.id,
    editedBy: me.userId,
    publishedAt,
  });

  // Creating a post directly as live is a transition-to-live → auto-send (if on).
  const liveTransition =
    !!publishedAt && new Date(publishedAt).getTime() <= Date.now();
  const settings = await getSettings();
  const newsletter = await maybeAutoSendNewsletter({
    postId: data.id,
    liveTransition,
    isAdmin: me.isAdmin,
    settings,
  });

  // Push the new post onto its cached pages immediately (no-op for drafts).
  await revalidatePost(data.slug);

  return NextResponse.json({ post: data, newsletter });
}
