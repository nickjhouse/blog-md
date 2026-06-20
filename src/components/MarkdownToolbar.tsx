"use client";

import type { FormatAction } from "@/lib/markdown-format";

// Material icon paths (24×24, fill=currentColor). H2/H3 use text glyphs since
// there's no clean single-path icon for them.
const ICON: Record<string, string> = {
  bold: "M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z",
  italic: "M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z",
  strike: "M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z",
  code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  codeblock:
    "M4 7v2c0 .55-.45 1-1 1H2v2h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h1v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 9.42 6 8.3 6 7V5c0-.55.45-1 1-1h1V2H7C5.35 2 4 3.35 4 5v2zm16 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-1v2h1c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-1v2h1c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-2h-1z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  quote: "M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z",
  ul: "M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z",
  ol: "M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z",
};

type Item = { action: FormatAction; title: string; path?: string; text?: string };

const GROUPS: Item[][] = [
  [
    { action: "bold", title: "Bold (⌘/Ctrl+B)", path: ICON.bold },
    { action: "italic", title: "Italic (⌘/Ctrl+I)", path: ICON.italic },
    { action: "strike", title: "Strikethrough", path: ICON.strike },
    { action: "code", title: "Inline code", path: ICON.code },
  ],
  [
    { action: "h2", title: "Heading 2", text: "H2" },
    { action: "h3", title: "Heading 3", text: "H3" },
  ],
  [
    { action: "quote", title: "Quote", path: ICON.quote },
    { action: "ul", title: "Bullet list", path: ICON.ul },
    { action: "ol", title: "Numbered list", path: ICON.ol },
  ],
  [
    { action: "link", title: "Link (⌘/Ctrl+K)", path: ICON.link },
    { action: "codeblock", title: "Code block", path: ICON.codeblock },
  ],
];

export function MarkdownToolbar({
  onAction,
}: {
  onAction: (action: FormatAction) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      role="toolbar"
      aria-label="Formatting"
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 ? (
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-[color:var(--border)]"
            />
          ) : null}
          {group.map((item) => (
            <button
              key={item.action}
              type="button"
              title={item.title}
              aria-label={item.title}
              onClick={() => onAction(item.action)}
              className="inline-flex h-7 min-w-[28px] items-center justify-center rounded px-1 text-xs font-medium text-[color:var(--muted)] hover:bg-[color:var(--hover)] hover:text-[color:var(--foreground)]"
            >
              {item.text ? (
                item.text
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d={item.path} />
                </svg>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
