import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPageBySlug, RESERVED_SLUGS } from "@/lib/pages";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { getSiteIdentity } from "@/lib/identity";

type Params = Promise<{ slug: string }>;

// ISR: enabled pages only (getPageBySlug uses the public client), no per-user
// data → cache-safe. force-static is needed because the data comes from a DB
// client, not Next's fetch cache. Shorter window so disabling a page takes it
// down promptly (admins always see live; on-demand revalidation later makes it
// instant). Disabled-page preview is the admin /admin/pages/[id]/preview route.
export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED_SLUGS.has(slug)) return { title: "Not found" };
  const page = await getPageBySlug(decodeURIComponent(slug));
  if (!page) return { title: "Not found" };
  return {
    title: page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/${page.slug}` },
    // Admins can preview a disabled page; keep those out of the index.
    robots: page.enabled ? undefined : { index: false, follow: false },
  };
}

// Generic static page (About, etc.) managed in the admin Pages area. Renders an
// ENABLED page by slug; disabled/missing → 404 for everyone (admins preview
// disabled pages via /admin/pages/[id]/preview). Reserved slugs are handled by
// their own static routes, so they never reach here — guarded anyway.
export default async function StaticPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (RESERVED_SLUGS.has(slug)) notFound();
  const page = await getPageBySlug(decodeURIComponent(slug));
  if (!page) notFound();

  const identity = await getSiteIdentity();
  const breadcrumb = breadcrumbJsonLd([
    { name: identity.name, url: SITE_URL },
    { name: page.title, url: `${SITE_URL}/${page.slug}` },
  ]);

  return (
    <article className="prose-content">
      <JsonLd data={breadcrumb} />
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        {page.title}
      </h1>
      <div dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
    </article>
  );
}
