import type { Metadata } from "next";
import { searchPosts } from "@/lib/posts";
import { PostListItem } from "@/components/PostListItem";
import { SearchBox } from "@/components/SearchBox";
import { SearchTracker } from "@/components/SearchTracker";

export const metadata: Metadata = {
  title: "Search",
  // Search-result pages shouldn't be indexed (thin / duplicate content).
  robots: { index: false, follow: true },
};

// Stays dynamic (reads the ?q= query each request; also Option C).
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchPosts(query) : [];

  return (
    <section>
      <h1 className="font-serif text-3xl font-bold tracking-tight">Search</h1>

      <div className="mt-6 max-w-lg">
        <SearchBox initialQuery={query} />
      </div>

      {query ? <SearchTracker query={query} results={results.length} /> : null}

      {query ? (
        <div className="mt-8">
          <p className="text-sm text-(--muted)">
            {results.length === 0
              ? `No results for “${query}”.`
              : `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`}
          </p>
          <div className="mt-2">
            {results.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-(--muted)">
          Type a few words to search across all posts.
        </p>
      )}
    </section>
  );
}
