"use client";

import { useState } from "react";

// Small RSS icon button that copies the scoped feed URL to the clipboard, with a
// native hover tooltip ("Copy RSS feed URL") and a brief "Copied!" confirmation.
export function RssCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for non-secure contexts / older browsers.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* give up silently */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={copy}
        title="Copy RSS feed URL"
        aria-label="Copy RSS feed URL"
        className="rounded-md p-1.5 text-[color:var(--muted)] hover:bg-[color:var(--hover)] hover:text-[color:var(--foreground)]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      </button>
      <span
        aria-live="polite"
        className={`pointer-events-none absolute left-full top-1/2 ml-1 -translate-y-1/2 whitespace-nowrap rounded bg-[color:var(--button-bg)] px-1.5 py-0.5 text-xs text-[color:var(--button-fg)] transition-opacity ${
          copied ? "opacity-100" : "opacity-0"
        }`}
      >
        Copied!
      </span>
    </span>
  );
}
