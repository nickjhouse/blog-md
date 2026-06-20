import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { PostListed } from "@/lib/posts";

// A single row in the clean & minimal feed: category · date, title, excerpt.
export function PostListItem({ post }: { post: PostListed }) {
  return (
    <article className="relative mb-4 rounded-xl border border-(--border) bg-(--surface) p-5 transition-colors hover:border-(--accent) focus-within:border-(--accent)">
      <div className="text-xs text-(--muted)">
        {post.category ? (
          <>
            <Link
              href={`/category/${post.category.slug}`}
              prefetch={false}
              className="relative z-10 hover:underline"
            >
              {post.category.name}
            </Link>
            <span aria-hidden> · </span>
          </>
        ) : null}
        {formatDate(post.published_at)}
        {post.reading_minutes ? (
          <>
            <span aria-hidden> · </span>
            {post.reading_minutes} min read
          </>
        ) : null}
      </div>
      <h2 className="mt-1 font-serif text-xl font-semibold tracking-tight">
        {/* Stretched link: the ::after overlay makes the whole card clickable
            while keeping a single semantic link + one tab stop. */}
        <Link
          href={`/post/${post.slug}`}
          prefetch={false}
          className="after:absolute after:inset-0 after:content-[''] hover:underline"
        >
          {post.title}
        </Link>
      </h2>
      {post.excerpt ? (
        <p className="mt-1 text-black/70 dark:text-white/70">{post.excerpt}</p>
      ) : null}
    </article>
  );
}
