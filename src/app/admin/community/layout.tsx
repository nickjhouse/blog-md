import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/auth";
import { countModerationQueue } from "@/lib/moderation";
import { countUnreadContactMessages } from "@/lib/contact";
import { CommunityTabs } from "@/components/CommunityTabs";

// Admin-only community hub: moderation, messages, users. The /admin layout only
// gates contributors, so re-check admin here (each /api/admin/* route re-checks
// independently too). Tab badges show the same counts the nav badge sums.
export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getAdminContext())) redirect("/admin");

  const [moderationCount, unreadMessages] = await Promise.all([
    countModerationQueue(),
    countUnreadContactMessages(),
  ]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Community</h1>
        <Link
          href="/admin"
          className="text-sm text-(--muted) hover:underline"
        >
          ← Posts
        </Link>
      </div>
      <CommunityTabs
        moderationCount={moderationCount}
        unreadMessages={unreadMessages}
      />
      <div className="mt-6">{children}</div>
    </section>
  );
}
