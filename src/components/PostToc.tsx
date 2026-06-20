"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/toc";

// Table of contents: a sticky sidebar in the left gutter on wide screens, and a
// collapsible "On this page" block inline on smaller ones. The active heading is
// tracked with an IntersectionObserver (no scroll listener) and highlighted in
// both. Server-rendered markup (works without JS); hydration adds the highlight.
export function PostToc({ toc }: { toc: TocItem[] }) {
  const [active, setActive] = useState<string>(toc[0]?.id ?? "");

  useEffect(() => {
    const headings = toc
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) setActive((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  function onJump(e: React.MouseEvent, id: string) {
    const target = document.getElementById(id);
    if (!target) return; // fall back to default anchor behavior
    e.preventDefault();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  const links = (
    <ul className="space-y-0.5">
      {toc.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            onClick={(e) => onJump(e, t.id)}
            className={`block border-l-2 py-1 text-sm leading-snug ${
              t.level === 3 ? "pl-6" : "pl-3"
            } ${
              active === t.id
                ? "border-[color:var(--accent)] font-medium text-[color:var(--accent)]"
                : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            {t.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop: sticky sidebar in the left gutter. */}
      <aside
        className="absolute inset-y-0 right-full hidden pr-8 xl:block"
        aria-label="Table of contents"
      >
        <nav className="sticky top-24 w-44">
          <p className="mb-2 text-xs font-medium text-[color:var(--muted)]">
            On this page
          </p>
          {links}
        </nav>
      </aside>

      {/* Mobile/tablet: collapsible block above the body. */}
      <details className="mb-6 rounded-md border border-[color:var(--border)] xl:hidden">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          On this page
        </summary>
        <nav className="px-2 pb-2">{links}</nav>
      </details>
    </>
  );
}
