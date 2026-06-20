// Parses the richer front-matter produced by the markdown export
// (src/app/api/admin/export). Read-only; tolerant of missing/extra keys.
// Mirrors the export's quoting (double-quoted, with \" \n \\ escaped).

export type ImportFrontmatter = {
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  cover?: string;
  cover_alt?: string;
  tags?: string[];
  status?: string;
  published_at?: string;
};

function unquote(v: string): string {
  let s = v.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
}

export function parseImportMarkdown(raw: string): {
  frontmatter: ImportFrontmatter;
  body: string;
} {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(raw);
  if (!match) return { frontmatter: {}, body: raw };

  const body = raw.slice(match[0].length);
  const fm: ImportFrontmatter = {};

  for (const line of match[1].split("\n")) {
    const m = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    const rawVal = m[2].trim();
    if (!rawVal) continue;

    switch (key) {
      case "title":
        fm.title = unquote(rawVal);
        break;
      case "slug":
        fm.slug = unquote(rawVal);
        break;
      case "category":
        fm.category = unquote(rawVal);
        break;
      case "excerpt":
        fm.excerpt = unquote(rawVal);
        break;
      case "cover":
        fm.cover = unquote(rawVal);
        break;
      case "cover_alt":
        fm.cover_alt = unquote(rawVal);
        break;
      case "status":
        fm.status = unquote(rawVal);
        break;
      case "published_at":
        fm.published_at = unquote(rawVal);
        break;
      case "tags": {
        const inner = rawVal.replace(/^\[/, "").replace(/\]$/, "");
        fm.tags = inner
          .split(",")
          .map((s) => unquote(s))
          .filter(Boolean);
        break;
      }
      default:
        break;
    }
  }

  return { frontmatter: fm, body };
}
