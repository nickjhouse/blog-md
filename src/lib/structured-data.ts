import { SITE_URL } from "@/lib/site.config";
import type { SiteIdentity } from "@/lib/identity";
import type { PostFull } from "@/lib/posts";

// Build schema.org JSON-LD for Google. All values are dynamic (site identity +
// per-post data). Undefined fields are dropped by JSON.stringify, so optional
// data simply omits its key.

// Resolve any URL to an absolute one (logos/images may be relative paths).
function abs(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Shared publisher node, referenced by @id from WebSite + BlogPosting.
function organizationNode(identity: SiteIdentity, logoUrl: string) {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: identity.name,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: abs(logoUrl) },
  };
}

// Home page: WebSite (+ sitelinks SearchAction) and the publisher Organization.
export function websiteJsonLd(identity: SiteIdentity, logoUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(identity, logoUrl),
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: identity.name,
        description: identity.description,
        inLanguage: identity.locale,
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

// Breadcrumb trail (Home › … › current). Google renders these in results.
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

// Listing pages (category / tag / series / author): CollectionPage + ItemList.
export function collectionPageJsonLd(opts: {
  url: string;
  name: string;
  description?: string;
  locale: string;
  items: { name: string; url: string }[];
}) {
  const { url, name, description, locale, items } = opts;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name,
    description: description ?? undefined,
    inLanguage: locale,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: it.url,
      })),
    },
  };
}

// Post page: BlogPosting (+ the publisher Organization).
export function blogPostingJsonLd(opts: {
  post: PostFull;
  identity: SiteIdentity;
  logoUrl: string;
  imageUrl?: string;
}) {
  const { post, identity, logoUrl, imageUrl } = opts;
  const url = `${SITE_URL}/post/${post.slug}`;

  const author = post.author?.display_name
    ? {
        "@type": "Person",
        name: post.author.full_name?.trim() || post.author.display_name,
        url: `${SITE_URL}/author/${encodeURIComponent(post.author.display_name)}`,
      }
    : { "@type": "Organization", name: identity.name, url: SITE_URL };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(identity, logoUrl),
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.excerpt ?? undefined,
        image: imageUrl ? [abs(imageUrl)] : undefined,
        datePublished: post.published_at ?? undefined,
        dateModified: post.updated_at ?? post.published_at ?? undefined,
        author,
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        url,
        articleSection: post.category?.name ?? undefined,
        keywords: post.tags.length
          ? post.tags.map((t) => t.name).join(", ")
          : undefined,
        inLanguage: identity.locale,
      },
    ],
  };
}
