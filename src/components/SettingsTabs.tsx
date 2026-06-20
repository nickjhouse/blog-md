"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tab order is config-driven so the identity/theme editors slot in by
// flipping `enabled` once built. Until then they render disabled.
const TABS: { label: string; href: string; enabled: boolean }[] = [
  { label: "Identity", href: "/admin/settings/identity", enabled: true },
  { label: "Brand mark", href: "/admin/settings/brand", enabled: true },
  { label: "Theme", href: "/admin/settings/theme", enabled: true },
  { label: "Comments", href: "/admin/settings/comments", enabled: true },
  { label: "Newsletter", href: "/admin/settings/newsletter", enabled: true },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-(--border) text-sm"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        if (!tab.enabled) {
          return (
            <span
              key={tab.href}
              aria-disabled="true"
              title="Coming soon"
              className="-mb-px cursor-not-allowed border-b-2 border-transparent pb-2 text-(--muted) opacity-50"
            >
              {tab.label}
            </span>
          );
        }
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
