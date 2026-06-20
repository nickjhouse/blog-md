"use client";

import { useEffect, useRef, useState } from "react";

// A thin vertical rail in the article's left padding that spans the section
// you're currently reading. The body is a flat HTML blob (no per-section
// elements), so instead of wrapping sections we measure heading bounds and
// position one floating rail. Active heading tracked with an IntersectionObserver
// (shares the TOC's logic/margins so the sidebar highlight and rail stay in sync).
export function ActiveSectionRail() {
  const ref = useRef<HTMLDivElement>(null);
  const [rail, setRail] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    const wrap = el?.parentElement;
    if (!wrap) return;
    const heads = Array.from(
      wrap.querySelectorAll("h2[id], h3[id]"),
    ) as HTMLElement[];
    if (!heads.length) return;

    let idx = 0;
    const place = () => {
      const wrapTop = wrap.getBoundingClientRect().top;
      const h = heads[idx];
      const next = heads[idx + 1];
      const top = h.getBoundingClientRect().top - wrapTop;
      // End at the bottom of the section's LAST content element, not the next
      // heading's top — otherwise the rail covers the empty margin between
      // sections. For the final section, fall back to the body's bottom.
      let bottom: number;
      if (next) {
        const lastContent = next.previousElementSibling ?? next;
        bottom = lastContent.getBoundingClientRect().bottom - wrapTop;
      } else {
        const prose = h.parentElement;
        bottom = (prose ?? h).getBoundingClientRect().bottom - wrapTop;
      }
      setRail({ top, height: Math.max(0, bottom - top) });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const i = heads.indexOf(visible[0].target as HTMLElement);
          if (i >= 0) {
            idx = i;
            place();
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    heads.forEach((h) => observer.observe(h));
    place();
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 w-[2px] bg-(--accent) transition-all duration-200"
      style={rail ? { transform: `translateY(${rail.top}px)`, height: rail.height } : { opacity: 0 }}
    />
  );
}
