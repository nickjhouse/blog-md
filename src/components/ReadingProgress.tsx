"use client";

import { useEffect, useState } from "react";

// Fixed bar at the very top that fills as you read the ARTICLE — not the whole
// page. It measures from the article's top to a #reading-end marker placed after
// the post body, so it reaches 100% at the end of the content (comments/related
// below don't count). Falls back to whole-page scroll if the marker is missing.
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      const sy = window.scrollY;
      const article = document.querySelector("article");
      const end = document.getElementById("reading-end");
      let p = 0;
      if (article && end) {
        const startDoc = article.getBoundingClientRect().top + sy;
        const endDoc = end.getBoundingClientRect().top + sy;
        const denom = endDoc - window.innerHeight - startDoc;
        p = denom > 0 ? ((sy - startDoc) / denom) * 100 : sy >= startDoc ? 100 : 0;
      } else {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        p = max > 0 ? (el.scrollTop / max) * 100 : 0;
      }
      setPct(Math.min(100, Math.max(0, p)));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="fixed left-0 top-0 z-50 h-[3px] bg-(--accent)"
      style={{ width: `${pct}%` }}
      aria-hidden="true"
    />
  );
}
