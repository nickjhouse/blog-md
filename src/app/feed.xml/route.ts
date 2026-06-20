import { getPostsForFeed } from "@/lib/seo";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { buildRssXml, rssResponse } from "@/lib/feed";

// Regenerate on every request so the feed always reflects the live set of
// published posts (same reasoning as the sitemap; no ISR cache configured).
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [posts, identity] = await Promise.all([
    getPostsForFeed(30),
    getSiteIdentity(),
  ]);

  const body = buildRssXml({
    title: identity.name,
    description: identity.description,
    link: SITE_URL,
    feedUrl: `${SITE_URL}/feed.xml`,
    language: identity.locale,
    posts,
  });
  return rssResponse(body);
}
