import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { PostListed } from "@/lib/posts";

// Compact "you might also like" list shown under a post. Renders nothing when
// there are no related posts, so the post page can include it unconditionally.
export function RelatedPosts({ posts }: { posts: PostListed[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 border-t border-(--border) pt-6">
      <h2 className="font-serif text-xl font-semibold tracking-tight">
        Related posts
      </h2>
      <ul className="mt-4 space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/post/${post.slug}`}
              prefetch={false}
              className="font-serif text-lg font-medium hover:underline"
            >
              {post.title}
            </Link>
            <div className="text-xs text-(--muted)">
              {post.category ? (
                <>
                  {post.category.name}
                  <span aria-hidden> · </span>
                </>
              ) : null}
              {formatDate(post.published_at)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
