import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getContributorContext } from "@/lib/auth";
import { getAllPostsForAdmin } from "@/lib/posts";
import { countUnreadContactMessages } from "@/lib/contact";
import { countModerationQueue } from "@/lib/moderation";
import { AdminNav } from "@/components/AdminNav";
import { AdminPostsList } from "@/components/AdminPostsList";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const me = await getContributorContext();
  if (!me) redirect("/");

  // Admins see all posts; authors see only their own.
  const posts = await getAllPostsForAdmin(me.isAdmin ? undefined : me.userId);
  // Nav badges (admin-only nav below): unread contact messages + the moderation
  // queue (pending + reported comments). Fetched in parallel.
  const [unreadMessages, moderationCount] = me.isAdmin
    ? await Promise.all([countUnreadContactMessages(), countModerationQueue()])
    : [0, 0];

  return (
    <section>
      {/* Primary action sits with the heading; utility nav is its own row. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {me.isAdmin ? "Posts" : "My posts"}
        </h1>
        <Link
          href="/admin/new"
          className="shrink-0 rounded-md bg-[color:var(--button-bg)] px-3 py-1.5 text-sm font-medium text-[color:var(--button-fg)]"
        >
          New post
        </Link>
      </div>
      {/* Utility nav is admin-only; authors only manage their own posts. */}
      {me.isAdmin ? (
        <AdminNav
          unreadMessages={unreadMessages}
          moderationCount={moderationCount}
        />
      ) : null}

      <AdminPostsList posts={posts} />
    </section>
  );
}
