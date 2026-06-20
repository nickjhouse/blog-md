import Link from "next/link";
import { getPostsPage, getActiveCategories } from "@/lib/posts";
import { getPublishedSeries } from "@/lib/series";
import { InfiniteFeed } from "@/components/InfiniteFeed";
import { CategoryNav } from "@/components/CategoryNav";
import { getSiteIdentity } from "@/lib/identity";
import { getSettingsCached } from "@/lib/settings";
import { brandLogoUrl } from "@/lib/brand";
import { websiteJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";

// ISR: the feed has no per-user data (nav hydrates client-side). force-static is
// required because the data comes from a DB client, not Next's fetch cache.
// Shorter window than posts — feeds change when a post is published.
export const dynamic = "force-static";
export const revalidate = 60;

export default async function HomePage() {
  const [feed, categories, series, identity, settings] = await Promise.all([
    getPostsPage({ limit: 10 }),
    getActiveCategories(),
    getPublishedSeries(),
    getSiteIdentity(),
    getSettingsCached(),
  ]);
  const jsonLd = websiteJsonLd(identity, brandLogoUrl(settings));

  return (
    <section>
      <JsonLd data={jsonLd} />

      {identity.homeIntroEnabled ? (
        <section className="mb-8 border-b border-(--border) pb-6">
          {identity.homeIntro
            ? identity.homeIntro
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p
                    key={i}
                    className={`text-[color:var(--muted)]${i > 0 ? " mt-2" : ""}`}
                  >
                    {para}
                  </p>
                ))
            : null}
          <p className="mt-2 text-sm text-(--muted)">
            Signing in is optional — used only to comment and manage your account.
            See our{" "}
            <Link
              href="/privacy"
              className="text-(--accent) hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      ) : null}

      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Latest posts
      </h1>
      <CategoryNav categories={categories} />

      {/* Surface series on the home page only once there are a few to browse. */}
      {series.length > 3 ? (
        <div className="mt-6 rounded-xl border border-(--border) bg-(--surface) p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-lg font-semibold tracking-tight">
              Series
            </h2>
            <Link
              href="/series"
              className="text-sm text-(--accent) hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {series.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/series/${s.slug}`}
                  className="inline-block rounded-md border border-(--border-strong) px-2.5 py-1 text-sm hover:border-(--accent) hover:text-(--accent)"
                >
                  {s.title}{" "}
                  <span className="text-(--muted)">
                    · {s.published}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <InfiniteFeed initialPosts={feed.posts} initialHasMore={feed.hasMore} />
    </section>
  );
}
