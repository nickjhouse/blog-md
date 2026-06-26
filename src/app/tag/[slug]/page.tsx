import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTagBySlug, getPostsByTagId } from "@/lib/posts";
import { PostListItem } from "@/components/PostListItem";
import { RssCopyButton } from "@/components/RssCopyButton";
import { getSiteIdentity } from "@/lib/identity";
import { SITE_URL } from "@/lib/site.config";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";

type Params = Promise<{ slug: string }>;

// ISR (see home page note). force-static + revalidate so the DB-backed feed is
// cached; no per-user data in the render.
export const dynamic = "force-static";
export const revalidate = 1800; // 30-min fallback; publishes revalidate on-demand

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Not found" };
  return {
    title: `#${tag.name}`,
    alternates: {
      canonical: `/tag/${tag.slug}`,
      types: { "application/rss+xml": `/tag/${tag.slug}/feed.xml` },
    },
  };
}

export default async function TagPage({ params }: { params: Params }) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const [posts, identity] = await Promise.all([
    getPostsByTagId(tag.id),
    getSiteIdentity(),
  ]);
  // A tag with no live posts is a thin/empty page (and tag rows can outlive
  // their posts) — 404 rather than serve it. Re-populates via revalidatePath
  // when a post with this tag is published.
  if (posts.length === 0) notFound();

  const url = `${SITE_URL}/tag/${tag.slug}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: identity.name, url: SITE_URL },
    { name: `#${tag.name}`, url },
  ]);
  const collection = collectionPageJsonLd({
    url,
    name: `#${tag.name}`,
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
          #{tag.name}
        </h1>
        <RssCopyButton url={`${SITE_URL}/tag/${tag.slug}/feed.xml`} />
      </div>
      <div className="mt-6">
        {posts.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            No posts with this tag yet.
          </p>
        ) : (
          posts.map((post) => <PostListItem key={post.id} post={post} />)
        )}
      </div>
    </section>
  );
}
