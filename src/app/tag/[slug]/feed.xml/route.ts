import { getTagFeed } from "@/lib/seo";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { buildRssXml, rssResponse } from "@/lib/feed";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { slug } = await params;
  const [feed, identity] = await Promise.all([
    getTagFeed(decodeURIComponent(slug)),
    getSiteIdentity(),
  ]);
  if (!feed) return new Response("Not found", { status: 404 });

  const body = buildRssXml({
    title: `${identity.name} — ${feed.label}`,
    description: `Posts tagged ${feed.label} on ${identity.name}.`,
    link: `${SITE_URL}/tag/${slug}`,
    feedUrl: `${SITE_URL}/tag/${slug}/feed.xml`,
    language: identity.locale,
    posts: feed.posts,
  });
  return rssResponse(body);
}
