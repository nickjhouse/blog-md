import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthorPage } from "@/lib/posts";
import { PostListItem } from "@/components/PostListItem";
import { getSiteIdentity } from "@/lib/identity";
import { SITE_URL } from "@/lib/site.config";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";
import { SOCIAL_ICON_PATHS } from "@/lib/social-icons";
import { safeExternalUrl } from "@/lib/url";
import { RssCopyButton } from "@/components/RssCopyButton";

// Generic link glyph for the website field (the rest are brand icons).
const LINK_ICON =
  "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z";

type Params = Promise<{ username: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await getAuthorPage(decodeURIComponent(username));
  if (!data) return { title: "Not found" };
  return {
    title: `Posts by ${data.fullName?.trim() || data.displayName}`,
    alternates: {
      canonical: `/author/${data.displayName}`,
      types: {
        "application/rss+xml": `/author/${data.displayName}/feed.xml`,
      },
    },
  };
}

export default async function AuthorPage({ params }: { params: Params }) {
  const { username } = await params;
  const data = await getAuthorPage(decodeURIComponent(username));
  if (!data) notFound();

  const identity = await getSiteIdentity();
  const label = data.fullName?.trim() || data.displayName;
  const url = `${SITE_URL}/author/${encodeURIComponent(data.displayName)}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: identity.name, url: SITE_URL },
    { name: label, url },
  ]);
  const collection = collectionPageJsonLd({
    url,
    name: `Posts by ${label}`,
    locale: identity.locale,
    items: data.posts.map((p) => ({
      name: p.title,
      url: `${SITE_URL}/post/${p.slug}`,
    })),
  });

  const socialLinks = [
    { label: "Website", url: safeExternalUrl(data.socials.website), path: LINK_ICON },
    { label: "X", url: safeExternalUrl(data.socials.x), path: SOCIAL_ICON_PATHS.x },
    { label: "GitHub", url: safeExternalUrl(data.socials.github), path: SOCIAL_ICON_PATHS.github },
    { label: "Bluesky", url: safeExternalUrl(data.socials.bluesky), path: SOCIAL_ICON_PATHS.bluesky },
    { label: "Mastodon", url: safeExternalUrl(data.socials.mastodon), path: SOCIAL_ICON_PATHS.mastodon },
    { label: "LinkedIn", url: safeExternalUrl(data.socials.linkedin), path: SOCIAL_ICON_PATHS.linkedin },
  ].filter((s): s is { label: string; url: string; path: string } => !!s.url);
  const initial = data.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <section>
      <JsonLd data={breadcrumb} />
      <JsonLd data={collection} />

      <div className="flex items-center gap-4">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatarUrl}
            alt=""
            width={64}
            height={64}
            referrerPolicy="no-referrer"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-(--hover) text-2xl font-medium text-(--muted)">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {data.fullName?.trim() || data.displayName}
            </h1>
            <RssCopyButton
              url={`${SITE_URL}/author/${encodeURIComponent(data.displayName)}/feed.xml`}
            />
          </div>
          <p className="mt-1 text-sm text-(--muted)">
            {data.fullName?.trim() ? (
              <>
                <span>@{data.displayName}</span>
                <span aria-hidden> · </span>
              </>
            ) : null}
            {data.posts.length} post{data.posts.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {data.bio ? (
        <p className="mt-4 max-w-prose text-(--muted)">{data.bio}</p>
      ) : null}

      {socialLinks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {socialLinks.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="me noopener noreferrer"
              aria-label={s.label}
              title={s.label}
              className="text-(--muted) hover:text-(--foreground)"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={s.path} />
              </svg>
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {data.posts.length === 0 ? (
          <p className="text-(--muted)">No posts yet.</p>
        ) : (
          data.posts.map((post) => <PostListItem key={post.id} post={post} />)
        )}
      </div>
    </section>
  );
}
