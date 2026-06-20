import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeriesBySlug } from "@/lib/series";
import { PostListItem } from "@/components/PostListItem";
import { getSiteIdentity } from "@/lib/identity";
import { SITE_URL } from "@/lib/site.config";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) return { title: "Not found" };
  return {
    title: series.title,
    description: series.description ?? undefined,
    alternates: { canonical: `/series/${series.slug}` },
  };
}

export default async function SeriesPage({ params }: { params: Params }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();

  const identity = await getSiteIdentity();
  const url = `${SITE_URL}/series/${series.slug}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: identity.name, url: SITE_URL },
    { name: series.title, url },
  ]);
  const collection = collectionPageJsonLd({
    url,
    name: series.title,
    description: series.description ?? undefined,
    locale: identity.locale,
    items: series.parts.map((p) => ({
      name: p.title,
      url: `${SITE_URL}/post/${p.slug}`,
    })),
  });

  return (
    <section>
      <JsonLd data={breadcrumb} />
      <JsonLd data={collection} />
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        {series.title}
      </h1>
      {series.description ? (
        <p className="mt-2 text-(--muted)">{series.description}</p>
      ) : null}
      <p className="mt-2 text-sm text-(--muted)">
        {series.parts.length} part{series.parts.length === 1 ? "" : "s"}, in order
      </p>

      <div className="mt-6">
        {series.parts.length === 0 ? (
          <p className="text-(--muted)">No published parts yet.</p>
        ) : (
          series.parts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))
        )}
      </div>
    </section>
  );
}
