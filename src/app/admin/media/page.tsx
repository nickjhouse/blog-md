import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { MediaBrowser } from "@/components/MediaBrowser";

export const metadata: Metadata = { title: "Media" };
export const dynamic = "force-dynamic";

// Media Library. Admin-only — re-checked here like every other admin-utility page
// (the /admin layout only gates contributors). Browse, upload, and delete images;
// "unused only" surfaces orphans not referenced by any post.
export default async function MediaPage() {
  if (!(await getAdminContext())) redirect("/admin");
  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Media</h1>
        <Link
          href="/admin"
          className="text-sm text-(--muted) hover:underline"
        >
          ← Posts
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-sm text-(--muted)">
        Browse, upload, and clean up images. “Unused” images aren’t referenced by
        any post’s cover, social image, or body — safe to delete to reclaim
        storage.
      </p>
      <div className="mt-6">
        <MediaBrowser mode="manage" />
      </div>
    </section>
  );
}
