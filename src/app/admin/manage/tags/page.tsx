import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getTagsWithCounts } from "@/lib/posts";
import { TagManager } from "@/components/TagManager";

export const metadata: Metadata = { title: "Tags · Manage" };
export const dynamic = "force-dynamic";

export default async function ManageTagsPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const tags = await getTagsWithCounts();

  return (
    <div>
      <p className="text-sm text-(--muted)">
        Add a tag here, or just type one in the post editor. Deleting a tag
        removes it from its posts (posts aren’t deleted). A tag on no posts counts
        as unused — “Remove all unused” clears them, so a tag you pre-create won’t
        stick around unless a post uses it.
      </p>
      <TagManager tags={tags} />
    </div>
  );
}
