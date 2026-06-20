"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Categories", href: "/admin/manage/categories" },
  { label: "Tags", href: "/admin/manage/tags" },
  { label: "Series", href: "/admin/manage/series" },
];

export function ManageTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Manage sections"
      className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-(--border) text-sm"
    >
      {TABS.map((tab) => {
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
          </Link>
        );
      })}
    </nav>
  );
}
