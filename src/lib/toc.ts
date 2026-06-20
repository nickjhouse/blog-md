import { slugify } from "@/lib/slug";

// Table-of-contents extraction. Runs at render over stored body_html, so it
// works for every post regardless of when it was saved (no migration/re-save):
// it ensures each h2/h3 has a unique, slugified id and returns the heading list.

export type TocItem = { id: string; text: string; level: 2 | 3 };

const decodeEntities = (s: string): string =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

export function buildToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const unique = (base: string): string => {
    const root = base || "section";
    let candidate = root;
    let n = 2;
    while (used.has(candidate)) candidate = `${root}-${n++}`;
    used.add(candidate);
    return candidate;
  };

  const out = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (match, lvl: string, attrs: string, inner: string) => {
      const text = decodeEntities(inner);
      if (!text) return match;
      const level = (lvl === "3" ? 3 : 2) as 2 | 3;

      const existing = attrs.match(/\sid="([^"]+)"/);
      let id: string;
      let newAttrs = attrs;
      if (existing) {
        id = existing[1];
        used.add(id);
      } else {
        id = unique(slugify(text));
        newAttrs = `${attrs} id="${id}"`;
      }
      toc.push({ id, text, level });
      return `<h${lvl}${newAttrs}>${inner}</h${lvl}>`;
    },
  );

  return { html: out, toc };
}
