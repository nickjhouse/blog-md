import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPostBySlug, getRelatedPosts } from "@/lib/posts";
import { getPostReactions } from "@/lib/reactions";
import { EditPostButton } from "@/components/EditPostButton";
import { getSeriesForPost } from "@/lib/series";
import { SeriesNav } from "@/components/SeriesNav";
import { Comments } from "@/components/Comments";
import { RelatedPosts } from "@/components/RelatedPosts";
import { ReactionButton } from "@/components/ReactionButton";
import { BookmarkButton } from "@/components/BookmarkButton";
import { ShareButtons } from "@/components/ShareButtons";
import { formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/seo";
import { getSiteIdentity } from "@/lib/identity";
import { renderPageTokens } from "@/lib/page-tokens";
import { getSettingsCached } from "@/lib/settings";
import { brandLogoUrl } from "@/lib/brand";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";
import { mediaUrl, rewriteMediaHtml } from "@/lib/media-url";
import { buildToc } from "@/lib/toc";
import { PostToc } from "@/components/PostToc";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ActiveSectionRail } from "@/components/ActiveSectionRail";

type Params = Promise<{ slug: string }>;

// ISR: the post page is fully decoupled from per-user data (nav, edit, reaction,
// bookmark, comments all hydrate client-side), so it's cached in R2 and served
// statically, revalidated at most hourly. New posts render fresh on first visit;
// edits surface to anonymous readers within the window (the author sees live).
//
// force-static is required because the data comes from a DB client (supabase-js),
// not Next's fetch cache: without it, Next 15 treats those uncached reads as
// dynamic and re-renders every request (revalidate alone is ignored). The page
// uses no dynamic APIs (cookies/headers/searchParams), so forcing static is safe.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Not found" };

  const { name: siteName } = await getSiteIdentity();
  // SEO overrides, each falling back to the default behavior when unset.
  const title = post.seo_title?.trim() || post.title;
  const description = post.seo_description?.trim() || post.excerpt || undefined;
  const canonical = post.canonical_url?.trim() || `/post/${post.slug}`;
  // OG image: explicit override → cover image → (generated OG image via the
  // file-based convention when neither is set).
  const ogImageRaw = post.og_image?.trim() || post.cover_image || undefined;
  const images = ogImageRaw
    ? [mediaUrl(ogImageRaw, { absolute: true })]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots: post.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  // All global/cacheable — the post page no longer reads the signed-in viewer or
  // any per-user data. Comments (list + viewer + moderation state) are fetched
  // client-side by <Comments>; reaction count is global, and the viewer's own
  // like/bookmark state is fetched by those buttons. So this render is fully
  // cache-safe.
  const [related, series, identity, settings, reactions] = await Promise.all([
    getRelatedPosts(post.id),
    post.series_id ? getSeriesForPost(post.series_id) : Promise.resolve(null),
    getSiteIdentity(),
    getSettingsCached(),
    getPostReactions(post.id),
  ]);
  const jsonLd = blogPostingJsonLd({
    post,
    identity,
    logoUrl: brandLogoUrl(settings),
    imageUrl: post.og_image
      ? mediaUrl(post.og_image, { absolute: true })
      : post.cover_image
        ? mediaUrl(post.cover_image, { absolute: true })
        : `${SITE_URL}/post/${post.slug}/opengraph-image/og`,
  });
  const breadcrumb = breadcrumbJsonLd([
    { name: identity.name, url: SITE_URL },
    ...(post.category
      ? [
          {
            name: post.category.name,
            url: `${SITE_URL}/category/${post.category.slug}`,
          },
        ]
      : []),
    { name: post.title, url: `${SITE_URL}/post/${post.slug}` },
  ]);

  const { html: bodyHtml, toc } = buildToc(post.body_html);
  const showAids = toc.length >= 3;

  return (
    <article className="relative">
      {showAids ? <ReadingProgress /> : null}
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumb} />
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-(--muted) hover:underline"
        >
          ← Back
        </Link>
        <EditPostButton postId={post.id} authorId={post.author_id} />
      </div>

      {post.cover_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(post.cover_image)}
          alt={post.cover_alt ?? ""}
          // Covers are cropped to a fixed 2:1 (1600×800) on upload — declaring
          // the intrinsic size + aspect reserves the slot before the image
          // arrives (no layout shift), and fetchPriority promotes this
          // above-the-fold hero so it loads with the copy instead of after it.
          width={1600}
          height={800}
          fetchPriority="high"
          decoding="async"
          className="mt-6 aspect-2/1 max-h-112 w-full rounded-lg object-cover"
        />
      ) : null}

      <div className="mt-6 text-sm text-(--muted)">
        {post.category ? (
          <>
            <Link
              href={`/category/${post.category.slug}`}
              className="hover:underline"
            >
              {post.category.name}
            </Link>
            <span aria-hidden> · </span>
          </>
        ) : null}
        {formatDate(post.published_at)}
        {post.author?.display_name ? (
          <>
            <span aria-hidden> · </span>
            by{" "}
            <Link
              href={`/author/${post.author.display_name}`}
              className="hover:underline"
            >
              {post.author.full_name?.trim() || post.author.display_name}
            </Link>
          </>
        ) : null}
        {post.reading_minutes ? (
          <>
            <span aria-hidden> · </span>
            {post.reading_minutes} min read
          </>
        ) : null}
      </div>

      <h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-tight">
        {post.title}
      </h1>

      {series ? <SeriesNav series={series} currentSlug={post.slug} /> : null}

      {showAids ? <PostToc toc={toc} /> : null}

      <div className={showAids ? "relative pl-4 xl:pl-5" : undefined}>
        {showAids ? <ActiveSectionRail /> : null}
        <div
          className="prose-content mt-8"
          dangerouslySetInnerHTML={{
            __html: renderPageTokens(rewriteMediaHtml(bodyHtml), identity),
          }}
        />
      </div>
      {/* Marks the end of readable content for the reading-progress bar, so it
          reaches 100% here rather than after the comments below. */}
      {showAids ? <div id="reading-end" aria-hidden="true" /> : null}

      {post.tags.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <Link
              key={t.slug}
              href={`/tag/${t.slug}`}
              className="rounded-md border border-(--border) px-2.5 py-1 text-xs text-black/70 hover:border-(--accent) hover:text-(--accent) dark:text-white/70"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <ReactionButton
          postId={post.id}
          postSlug={post.slug}
          initialCount={reactions.count}
        />
        <BookmarkButton postId={post.id} postSlug={post.slug} />
      </div>

      <ShareButtons url={`${SITE_URL}/post/${post.slug}`} title={post.title} />

      <RelatedPosts posts={related} />

      <Comments postId={post.id} postSlug={post.slug} />
    </article>
  );
}
