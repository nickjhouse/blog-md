"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { markDismissed, shouldSuppress } from "@/lib/newsletter-prompt";
import type { NewsletterPromptTrigger } from "@/lib/settings";

// Routes where the capture card shouldn't appear — admin surfaces and the auth
// flows (the reader-facing public pages are the target).
const HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/signup",
  "/welcome",
  "/verify",
  "/reset",
  "/account",
];

// Non-modal sticky corner card. Armed by a trigger (scroll depth / time on page
// / exit intent); reveals once unless the visitor has already subscribed or
// dismissed it within the re-show window. Starts hidden and only appears via JS,
// so there's no SSR/hydration flash.
export function NewsletterPrompt({
  trigger,
  scrollPct,
  delaySeconds,
  redisplayDays,
}: {
  trigger: NewsletterPromptTrigger;
  scrollPct: number;
  delaySeconds: number;
  redisplayDays: number;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const hiddenRoute = HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  useEffect(() => {
    if (trigger === "off" || hiddenRoute) return;
    if (shouldSuppress(redisplayDays)) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setVisible(true);
    };

    if (trigger === "time") {
      const t = window.setTimeout(reveal, Math.max(0, delaySeconds) * 1000);
      return () => window.clearTimeout(t);
    }

    if (trigger === "scroll") {
      const onScroll = () => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const pct = max <= 0 ? 100 : (window.scrollY / max) * 100;
        if (pct >= scrollPct) reveal();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll(); // already past the threshold on a short page
      return () => window.removeEventListener("scroll", onScroll);
    }

    // exit intent. Desktop (fine pointer): cursor leaving through the top of the
    // viewport. Touch (coarse pointer): a fast upward scroll — the mobile-web
    // equivalent, signalling a reach for the back button / address bar.
    if (trigger === "exit") {
      if (window.matchMedia("(pointer: fine)").matches) {
        const onOut = (e: MouseEvent) => {
          if (e.clientY <= 0) reveal();
        };
        document.addEventListener("mouseout", onOut);
        return () => document.removeEventListener("mouseout", onOut);
      }

      // Coarse pointer: reveal on a deliberate fast flick upward, but only after
      // the reader has engaged (scrolled past ~1 viewport) so it can't trigger
      // at the very top. Velocity > ~0.6 px/ms (≈600 px/s) clears momentum/idle
      // scrolling without needing a precise gesture.
      let lastY = window.scrollY;
      let lastT = Date.now();
      let maxY = lastY;
      const onScroll = () => {
        const y = window.scrollY;
        const t = Date.now();
        maxY = Math.max(maxY, y);
        const upVel = (lastY - y) / Math.max(1, t - lastT); // +ve = scrolling up
        if (maxY > window.innerHeight && upVel > 0.6 && y < maxY - 200) {
          reveal();
        }
        lastY = y;
        lastT = t;
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
  }, [trigger, scrollPct, delaySeconds, redisplayDays, hiddenRoute]);

  if (!visible || hiddenRoute) return null;

  function dismiss() {
    markDismissed();
    setClosing(true);
    window.setTimeout(() => setVisible(false), 200);
  }

  return (
    <div
      role="dialog"
      aria-label="Newsletter signup"
      className={`fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-(--border) bg-(--surface) p-4 shadow-lg transition-all duration-200 sm:bottom-6 sm:right-6 ${
        closing
          ? "translate-y-2 opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-(--muted) hover:bg-(--hover)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="pr-5">
        <NewsletterSignup />
      </div>
    </div>
  );
}
