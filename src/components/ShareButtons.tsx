"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { SOCIAL_ICON_PATHS } from "@/lib/social-icons";

type Props = { url: string; title: string };

// Brand glyphs come from simple-icons (extracted at build time into
// social-icons.ts — see scripts/generate-social-icons.mjs). link/check are
// generic UI icons, not brand marks, so they stay inline here.
const UI_ICONS = {
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
} as const;

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

export function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const targets: { label: string; href: string; icon: string }[] = [
    {
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${u}&title=${t}`,
      icon: SOCIAL_ICON_PATHS.reddit,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      icon: SOCIAL_ICON_PATHS.x,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      icon: SOCIAL_ICON_PATHS.facebook,
    },
    {
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?text=${t}%20${u}`,
      icon: SOCIAL_ICON_PATHS.bluesky,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      track("share", { network: "copy" });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-(--border) px-3 py-1.5 text-sm hover:bg-(--hover)";

  return (
    <div className="mt-10 border-t border-(--border) pt-6">
      <span className="text-sm text-(--muted)">Share</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
            onClick={() => track("share", { network: s.label.toLowerCase() })}
          >
            <Icon path={s.icon} />
            {s.label}
          </a>
        ))}
        <button type="button" onClick={copy} className={btn}>
          <Icon path={copied ? UI_ICONS.check : UI_ICONS.link} />
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
