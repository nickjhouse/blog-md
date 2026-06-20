// Minimal YAML-ish front-matter splitter. No dependency (works in the browser),
// handles the common `key: value` case used to prefill title/category/excerpt
// when an uploaded .md file includes front-matter. Form values still win on save.

export type Frontmatter = {
  title?: string;
  category?: string;
  excerpt?: string;
  cover?: string;
};

export function splitFrontmatter(raw: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(raw);
  if (!match) return { frontmatter: {}, body: raw };

  const body = raw.slice(match[0].length);
  const frontmatter: Frontmatter = {};

  for (const line of match[1].split("\n")) {
    const m = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (key === "title") frontmatter.title = value;
    else if (key === "category") frontmatter.category = value;
    else if (key === "excerpt") frontmatter.excerpt = value;
    else if (key === "cover") frontmatter.cover = value;
  }

  return { frontmatter, body };
}
