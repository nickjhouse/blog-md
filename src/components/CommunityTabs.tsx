"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const badgeClass =
  "ml-1 rounded-full bg-(--accent) px-1.5 py-0.5 text-xs font-medium text-white";

export function CommunityTabs({
  moderationCount,
  unreadMessages,
}: {
  moderationCount: number;
  unreadMessages: number;
}) {
  const pathname = usePathname();
  const tabs = [
    { label: "Moderation", href: "/admin/community/moderation", badge: moderationCount },
    { label: "Messages", href: "/admin/community/messages", badge: unreadMessages },
    { label: "Users", href: "/admin/community/users", badge: 0 },
  ];

  return (
    <nav
      aria-label="Community sections"
      className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-(--border) text-sm"
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "-mb-px border-b-2 border-(--accent) pb-2 font-medium text-(--foreground)"
                : "-mb-px border-b-2 border-transparent pb-2 text-(--muted) hover:text-(--foreground)"
            }
          >
            {tab.label}
            {tab.badge > 0 ? <span className={badgeClass}>{tab.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
