import { getAuthorFeed } from "@/lib/seo";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { buildRssXml, rssResponse } from "@/lib/feed";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { username } = await params;
  const [feed, identity] = await Promise.all([
    getAuthorFeed(decodeURIComponent(username)),
    getSiteIdentity(),
  ]);
  if (!feed) return new Response("Not found", { status: 404 });

  const body = buildRssXml({
    title: `${identity.name} — Posts by ${feed.label}`,
    description: `Posts by ${feed.label} on ${identity.name}.`,
    link: `${SITE_URL}/author/${username}`,
    feedUrl: `${SITE_URL}/author/${username}/feed.xml`,
    language: identity.locale,
    posts: feed.posts,
  });
  return rssResponse(body);
}
