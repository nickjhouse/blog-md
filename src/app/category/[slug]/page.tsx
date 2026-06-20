import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCategoryBySlug,
  getPostsPage,
  getActiveCategories,
} from "@/lib/posts";
import { InfiniteFeed } from "@/components/InfiniteFeed";
import { CategoryNav } from "@/components/CategoryNav";
import { RssCopyButton } from "@/components/RssCopyButton";
import { getSiteIdentity } from "@/lib/identity";
import { SITE_URL } from "@/lib/site.config";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";

type Params = Promise<{ slug: string }>;

// ISR (see home page note). force-static + revalidate so the DB-backed feed is
// cached; no per-user data in the render.
export const dynamic = "force-static";
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Not found" };
  return {
    title: category.name,
    alternates: {
      canonical: `/category/${category.slug}`,
      types: {
        "application/rss+xml": `/category/${category.slug}/feed.xml`,
      },
    },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [feed, categories, identity] = await Promise.all([
    getPostsPage({ limit: 10, categoryId: category.id }),
    getActiveCategories(),
    getSiteIdentity(),
  ]);
  const posts = feed.posts;
  // An empty category page is thin content — 404 rather than serve it.
  // Re-populates via revalidatePath when a post in this category is published.
  if (posts.length === 0) notFound();

  const url = `${SITE_URL}/category/${category.slug}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: identity.name, url: SITE_URL },
    { name: category.name, url },
  ]);
  const collection = collectionPageJsonLd({
    url,
    name: category.name,
    locale: identity.locale,
    items: posts.map((p) => ({
      name: p.title,
      url: `${SITE_URL}/post/${p.slug}`,
    })),
  });

  return (
    <section>
      <JsonLd data={breadcrumb} />
      <JsonLd data={collection} />
      <div className="flex items-center gap-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          {category.name}
        </h1>
        <RssCopyButton
          url={`${SITE_URL}/category/${category.slug}/feed.xml`}
        />
      </div>
      <CategoryNav categories={categories} activeSlug={category.slug} />

      <InfiniteFeed
        initialPosts={posts}
        initialHasMore={feed.hasMore}
        categoryId={category.id}
        emptyMessage="No posts in this category yet."
      />
    </section>
  );
}
