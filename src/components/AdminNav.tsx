"use client";

import { useState } from "react";
import Link from "next/link";

// Admin utility nav.
//  - Desktop: inline row. The three HUB items (Manage, Community, Settings) reveal
//    a dropdown of their sub-pages on hover AND keyboard focus-within, so the
//    sub-links are reachable by mouse and by tabbing (no JS, no hover-only trap).
//  - Mobile: collapses to a single "Menu" disclosure carrying the tallied alert
//    count; hubs list their sub-pages indented beneath them (no hover on touch, so
//    everything's shown at once).

type SubItem = { href: string; label: string; badge?: number };
type NavItem = {
  href: string;
  label: string;
  badge: number;
  external?: boolean;
  sub?: SubItem[];
};

const badgeClass =
  "ml-1 rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-xs font-medium text-white";
const linkClass = "text-[color:var(--muted)] hover:underline";

function badge(n: number) {
  return n > 0 ? <span className={badgeClass}>{n}</span> : null;
}

// Leaf / external link — also used for hub items in the mobile menu (where the
// dropdown doesn't apply, so they're just links to the hub).
function renderLink(it: NavItem, onClick?: () => void) {
  const inner = (
    <>
      {it.label}
      {badge(it.badge)}
    </>
  );
  if (it.external) {
    return (
      // API download route, not a page — a Next.js <Link> would be inappropriate.
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      <a key={it.href} href={it.href} className={linkClass} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return (
    <Link key={it.href} href={it.href} className={linkClass} onClick={onClick}>
      {inner}
    </Link>
  );
}

// Desktop hub with a hover/focus dropdown of its sub-pages. Clicking the label
// still navigates to the hub (which lands on its first tab).
function renderHub(it: NavItem) {
  return (
    <div key={it.href} className="group relative">
      <Link href={it.href} className={`${linkClass} inline-flex items-center`}>
        {it.label}
        {badge(it.badge)}
        <span aria-hidden className="ml-1 text-xs">
          ▾
        </span>
      </Link>
      {/* invisible (not display:none) so sub-links join the tab order only when
          shown; `pt-1` bridges the gap so the cursor can travel into the card
          without it closing. Opens on group-hover and group-focus-within. */}
      <div className="invisible absolute left-0 top-full z-20 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="min-w-[11rem] rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
          {it.sub?.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-[color:var(--muted)] hover:bg-[color:var(--hover)] hover:text-[color:var(--foreground)]"
            >
              {s.label}
              {badge(s.badge ?? 0)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mobile menu item: leaf links render flat; hubs render as a header with their
// sub-pages listed (indented) beneath — everything visible at once since there's
// no hover on touch.
function renderMobileItem(it: NavItem, onClose: () => void) {
  if (!it.sub) return renderLink(it, onClose);
  return (
    <div key={it.href} className="flex flex-col gap-2">
      <Link
        href={it.href}
        onClick={onClose}
        className="inline-flex items-center font-medium text-[color:var(--foreground)]"
      >
        {it.label}
        {badge(it.badge)}
      </Link>
      <div className="flex flex-col gap-2 pl-3">
        {it.sub.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            onClick={onClose}
            className="inline-flex items-center text-[color:var(--muted)] hover:underline"
          >
            {s.label}
            {badge(s.badge ?? 0)}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminNav({
  unreadMessages,
  moderationCount,
}: {
  unreadMessages: number;
  moderationCount: number;
}) {
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    {
      href: "/admin/manage",
      label: "Manage",
      badge: 0,
      sub: [
        { href: "/admin/manage/categories", label: "Categories" },
        { href: "/admin/manage/tags", label: "Tags" },
        { href: "/admin/manage/series", label: "Series" },
      ],
    },
    { href: "/admin/media", label: "Media", badge: 0 },
    { href: "/admin/pages", label: "Pages", badge: 0 },
    {
      href: "/admin/community",
      label: "Community",
      badge: moderationCount + unreadMessages,
      sub: [
        { href: "/admin/community/moderation", label: "Moderation", badge: moderationCount },
        { href: "/admin/community/messages", label: "Messages", badge: unreadMessages },
        { href: "/admin/community/users", label: "Users" },
      ],
    },
    { href: "/admin/analytics", label: "Analytics", badge: 0 },
    { href: "/admin/import", label: "Import", badge: 0 },
    { href: "/api/admin/export", label: "Export", badge: 0, external: true },
    {
      href: "/admin/settings",
      label: "Settings",
      badge: 0,
      sub: [
        { href: "/admin/settings/brand", label: "Brand" },
        { href: "/admin/settings/comments", label: "Comments" },
        { href: "/admin/settings/identity", label: "Identity" },
        { href: "/admin/settings/newsletter", label: "Newsletter" },
        { href: "/admin/settings/theme", label: "Theme" },
      ],
    },
  ];
  const totalAlerts = unreadMessages + moderationCount;

  return (
    <div className="mt-3 border-t border-[color:var(--border)] pt-3 text-sm">
      {/* Desktop: inline row; hubs get a hover/focus dropdown. */}
      <nav className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex">
        {items.map((it) => (it.sub ? renderHub(it) : renderLink(it)))}
      </nav>

      {/* Mobile: a single labeled disclosure with the tallied alert count. */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 text-[color:var(--foreground)]"
        >
          <span className="font-medium">Menu</span>
          {badge(totalAlerts)}
          <span aria-hidden className="ml-0.5 text-[color:var(--muted)]">
            {open ? "▴" : "▾"}
          </span>
        </button>
        {open ? (
          <nav className="mt-3 flex flex-col gap-3">
            {items.map((it) => renderMobileItem(it, () => setOpen(false)))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
