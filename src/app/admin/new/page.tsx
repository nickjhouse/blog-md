import type { Metadata } from "next";
import { getContributorContext } from "@/lib/auth";
import { getCategoryOptions } from "@/lib/posts";
import { getSeriesOptions } from "@/lib/series";
import { getAuthorOptions } from "@/lib/users";
import { PostEditor } from "@/components/PostEditor";
import { getSiteIdentity } from "@/lib/identity";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const me = await getContributorContext();
  const [categories, series, authors, identity] = await Promise.all([
    getCategoryOptions(),
    getSeriesOptions(),
    me?.isAdmin ? getAuthorOptions() : Promise.resolve([]),
    getSiteIdentity(),
  ]);

  return (
    <section>
      <h1 className="text-2xl font-bold">New post</h1>
      <PostEditor
        mode="create"
        categories={categories}
        series={series}
        authors={authors}
        siteName={identity.name}
        contactEmail={identity.contactEmail}
        siteUrl={identity.url}
      />
    </section>
  );
}
