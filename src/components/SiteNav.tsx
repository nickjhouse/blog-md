"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./SessionProvider";

export function SiteNav({
  brandIconUrl,
  siteName,
}: {
  brandIconUrl: string;
  siteName: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Per-user nav is client-driven (from /api/me) so the server render carries no
  // auth state and is cache-safe. Server + pre-hydration → the logged-out shell
  // (session is null until the client fetch resolves), then it swaps to the
  // signed-in links. Anonymous visitors — whom we cache for — see correct nav
  // immediately; signed-in users see a brief swap on full loads only.
  const { session } = useSession();

  const links = (
    <>
      <Link href="/search" className="hover:underline" onClick={close}>
        Search
      </Link>
      {session?.isAuthor ? (
        <>
          <Link href="/admin" className="hover:underline" onClick={close}>
            {session.isAdmin ? "Admin" : "My posts"}
          </Link>
          <Link href="/admin/new" className="hover:underline" onClick={close}>
            New post
          </Link>
        </>
      ) : null}
      {session ? (
        <>
          <Link href="/bookmarks" className="hover:underline" onClick={close}>
            Saved
          </Link>
          <Link
            href="/account"
            className="text-[color:var(--muted)] hover:underline"
            onClick={close}
          >
            {session.displayName ?? "Account"}
          </Link>
          <SignOutButton />
        </>
      ) : (
        <Link href="/login" className="hover:underline" onClick={close}>
          Sign in
        </Link>
      )}
    </>
  );

  return (
    <nav aria-label="Main" className="mx-auto max-w-3xl px-4">
      <div className="flex items-center justify-between py-4">
        <Link
          href="/"
          className="flex items-center gap-2 whitespace-nowrap font-serif text-xl font-semibold tracking-tight"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brandIconUrl}
            alt=""
            width={32}
            height={32}
            className="shrink-0 -translate-y-px"
          />
          {siteName}
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 text-sm sm:flex">
          {links}
          <ThemeToggle />
        </div>

        {/* Mobile: theme toggle + menu button */}
        <div className="flex items-center gap-4 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {open ? (
        <div
          id="mobile-menu"
          className="flex flex-col items-start gap-3 border-t border-[color:var(--border)] pb-4 pt-3 text-sm sm:hidden"
        >
          {links}
        </div>
      ) : null}
    </nav>
  );
}
