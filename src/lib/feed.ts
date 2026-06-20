import { SITE_URL } from "@/lib/site.config";
import type { FeedPost } from "@/lib/seo";

// XML 1.0 only escapes a handful of characters; do them in the right order.
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Build an RSS 2.0 document. Shared by the global feed and the scoped
// (category / tag / author) feeds — they differ only in channel title/desc and
// the self link; items always point at the canonical /post/<slug> URL.
export function buildRssXml(opts: {
  title: string;
  description: string;
  link: string; // the human page this feed represents
  feedUrl: string; // the feed's own URL (atom:link rel=self)
  language: string;
  posts: FeedPost[];
}): string {
  const updated = opts.posts[0]?.published_at ?? new Date().toISOString();

  const items = opts.posts
    .map((p) => {
      const url = `${SITE_URL}/post/${p.slug}`;
      const pubDate = p.published_at
        ? new Date(p.published_at).toUTCString()
        : new Date().toUTCString();
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>${
        p.category ? `\n      <category>${escapeXml(p.category)}</category>` : ""
      }${
        p.excerpt
          ? `\n      <description>${escapeXml(p.excerpt)}</description>`
          : ""
      }
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(opts.title)}</title>
    <link>${escapeXml(opts.link)}</link>
    <description>${escapeXml(opts.description)}</description>
    <language>${escapeXml(opts.language)}</language>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(opts.feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

// Standard headers for an RSS response (1-hour shared-cache, same as before).
export function rssResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
