import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getContributorContext } from "@/lib/auth";
import { getCategoryOptions, getPostByIdForAdmin } from "@/lib/posts";
import { getSeriesOptions } from "@/lib/series";
import { getAuthorOptions } from "@/lib/users";
import { PostEditor } from "@/components/PostEditor";
import { getSiteIdentity } from "@/lib/identity";
import { NewsletterSendButton } from "@/components/NewsletterSendButton";

export const metadata: Metadata = { title: "Edit post" };

type Params = Promise<{ id: string }>;

export default async function EditPostPage({ params }: { params: Params }) {
  const { id } = await params;
  const me = await getContributorContext();
  if (!me) redirect("/admin");

  const [post, categories, series, authors, identity] = await Promise.all([
    getPostByIdForAdmin(id),
    getCategoryOptions(),
    getSeriesOptions(),
    me.isAdmin ? getAuthorOptions() : Promise.resolve([]),
    getSiteIdentity(),
  ]);
  if (!post) notFound();

  // Authors may only edit their own posts; admins may edit any.
  if (!me.isAdmin && post.author_id !== me.userId) redirect("/admin");

  const live =
    post.status === "published" &&
    !!post.published_at &&
    new Date(post.published_at).getTime() <= Date.now();

  return (
    <section>
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostEditor
        mode="edit"
        categories={categories}
        series={series}
        authors={authors}
        initial={post}
        siteName={identity.name}
        contactEmail={identity.contactEmail}
        siteUrl={identity.url}
      />
      {live && me.isAdmin ? (
        <NewsletterSendButton
          postId={post.id}
          initialSentAt={post.newsletter_sent_at}
        />
      ) : null}
    </section>
  );
}
