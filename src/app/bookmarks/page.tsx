import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getViewerContext } from "@/lib/auth";
import { getBookmarkedPosts } from "@/lib/bookmarks";
import { PostListItem } from "@/components/PostListItem";

export const metadata: Metadata = {
  title: "Saved",
  robots: { index: false, follow: false },
};

// Always reflect the latest saved set.
export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login?next=/bookmarks");

  const posts = await getBookmarkedPosts(viewer.userId);

  return (
    <section>
      <h1 className="font-serif text-3xl font-bold tracking-tight">Saved</h1>
      <p className="mt-2 text-sm text-(--muted)">
        Posts you’ve saved to read later.
      </p>

      <div className="mt-6">
        {posts.length === 0 ? (
          <p className="text-(--muted)">
            Nothing saved yet. Tap “Save” on any post to add it here.
          </p>
        ) : (
          posts.map((post) => <PostListItem key={post.id} post={post} />)
        )}
      </div>
    </section>
  );
}
