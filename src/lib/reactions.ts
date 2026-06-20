import { createAdminClient } from "@/lib/supabase/admin";

// Like count for a post, plus whether the given viewer has liked it. Reads go
// through the secret key (RLS is locked on reactions). Call from server only.
export async function getPostReactions(
  postId: string,
  viewerId?: string | null,
): Promise<{ count: number; liked: boolean }> {
  const supabase = createAdminClient();

  // Count and the viewer's like run concurrently (one round-trip instead of two).
  const [countRes, likedRes] = await Promise.all([
    supabase
      .from("reactions")
      .select("post_id", { count: "exact", head: true })
      .eq("post_id", postId),
    viewerId
      ? supabase
          .from("reactions")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return { count: countRes.count ?? 0, liked: !!likedRes.data };
}
