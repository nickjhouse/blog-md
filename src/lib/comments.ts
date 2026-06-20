import { createClient } from "@/lib/supabase/server";

export type CommentItem = {
  id: string;
  body: string;
  status: "visible" | "hidden" | "pending";
  created_at: string;
  edited_at: string | null;
  author_id: string;
  parent_id: string | null;
  author: { display_name: string | null; avatar_url: string | null } | null;
};

// Comments for a post, oldest first. RLS returns only visible comments to
// regular readers; admins also see hidden ones (flagged via `status`).
export async function getCommentsForPost(
  postId: string,
): Promise<CommentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, body, status, created_at, edited_at, author_id, parent_id, author:profiles(display_name, avatar_url)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Admin-only: which of these author ids are currently blocked. Used to show
// Block vs Unblock. Kept separate so block state isn't broadcast to everyone.
export async function getBlockedAuthorIds(
  authorIds: string[],
): Promise<string[]> {
  if (authorIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("id", authorIds)
    .eq("is_blocked", true);

  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}
