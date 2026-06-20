import { getCategoryFeed } from "@/lib/seo";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { buildRssXml, rssResponse } from "@/lib/feed";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { slug } = await params;
  const [feed, identity] = await Promise.all([
    getCategoryFeed(decodeURIComponent(slug)),
    getSiteIdentity(),
  ]);
  if (!feed) return new Response("Not found", { status: 404 });

  const body = buildRssXml({
    title: `${identity.name} — ${feed.label}`,
    description: `Posts in ${feed.label} on ${identity.name}.`,
    link: `${SITE_URL}/category/${slug}`,
    feedUrl: `${SITE_URL}/category/${slug}/feed.xml`,
    language: identity.locale,
    posts: feed.posts,
  });
  return rssResponse(body);
}
