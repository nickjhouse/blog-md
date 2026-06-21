import type { MetadataRoute } from "next";
import {
  SITE_URL,
  getPublishedPostsForSitemap,
  getCategorySlugsForSitemap,
  getTagSlugsForSitemap,
  getSeriesSlugsForSitemap,
  getAuthorUsernamesForSitemap,
} from "@/lib/seo";
import { getEnabledPagesForSitemap } from "@/lib/pages";
import { getSettingsCached } from "@/lib/settings";

// Render on every request so the sitemap always reflects the current set of
// published posts and categories — adding/removing/un-publishing is picked up
// live, without needing a redeploy. (We don't rely on ISR here since the R2
// incremental cache isn't configured.)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags, series, authors, pages, settings] =
    await Promise.all([
      getPublishedPostsForSitemap(),
      getCategorySlugsForSitemap(),
      getTagSlugsForSitemap(),
      getSeriesSlugsForSitemap(),
      getAuthorUsernamesForSitemap(),
      getEnabledPagesForSitemap(),
      getSettingsCached(),
    ]);

  return [
    { url: SITE_URL, lastModified: new Date() },
    // Contact is included only while enabled.
    ...(settings.contact_enabled ? [{ url: `${SITE_URL}/contact` }] : []),
    // Admin-managed pages (enabled only).
    ...pages.map((p) => ({
      url: `${SITE_URL}/${p.slug}`,
      lastModified: new Date(p.updatedAt),
    })),
    ...(series.length ? [{ url: `${SITE_URL}/series` }] : []),
    ...categories.map((slug) => ({
      url: `${SITE_URL}/category/${slug}`,
    })),
    ...tags.map((slug) => ({
      url: `${SITE_URL}/tag/${slug}`,
    })),
    ...series.map((slug) => ({
      url: `${SITE_URL}/series/${slug}`,
    })),
    ...authors.map((username) => ({
      url: `${SITE_URL}/author/${username}`,
    })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/post/${p.slug}`,
      lastModified: new Date(p.updated_at),
    })),
  ];
}
