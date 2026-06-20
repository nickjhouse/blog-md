import { createAdminClient } from "@/lib/supabase/admin";
import { LIST_COLUMNS, type PostListed } from "@/lib/posts";

// Bookmarks are private per user and RLS-locked, so reads use the secret key.
// Call from server only.

export async function isBookmarked(
  postId: string,
  viewerId?: string | null,
): Promise<boolean> {
  if (!viewerId) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewerId)
    .maybeSingle();
  return !!data;
}

// The viewer's bookmarked posts, most-recently-saved first. Only returns posts
// that are still published (so an unpublished/removed post drops off the list).
export async function getBookmarkedPosts(
  viewerId: string,
): Promise<PostListed[]> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("bookmarks")
    .select("post_id, created_at")
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false });

  const ids = (rows ?? []).map((r) => r.post_id);
  if (ids.length === 0) return [];

  const { data: posts } = await supabase
    .from("posts")
    .select(LIST_COLUMNS)
    .in("id", ids)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());

  const order = new Map(ids.map((id, i) => [id, i]));
  const list = posts ?? [];
  list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return list;
}
