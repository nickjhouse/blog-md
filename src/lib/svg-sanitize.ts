// ============================================================================
// SVG upload validator for the brand mark editor.
//
// Strategy: ALLOWLIST + REJECT (not strip-and-transform). An admin uploads their
// own icon, so we can afford to reject anything that isn't already clean rather
// than try to rewrite it. Benefits:
//   - No transform/serialization round-trip → no parser-mutation XSS bypasses,
//     and the stored bytes are byte-identical to the upload (SVG attribute case
//     like `viewBox` is preserved exactly).
//   - Zero dependencies → runs in the Cloudflare Workers runtime (no jsdom),
//     and is fully unit-testable.
//
// Threat model: the mark is rendered via <img> (a non-scripting context), but
// the file is also reachable at its public storage URL, where a direct
// navigation could execute embedded script in the storage origin. We block
// scripts, event handlers, foreign content, external references, and dangerous
// URI schemes so the stored file is inert no matter how it's loaded.
// ============================================================================

export const MAX_SVG_BYTES = 100_000; // 100 KB

// Elements an icon legitimately needs. Anything else (script, foreignObject,
// image, a, iframe, animate/SMIL, style, ...) is rejected by omission.
const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "symbol",
  "use",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "pattern",
]);

export type SvgValidation =
  | { ok: true; svg: string }
  | { ok: false; reason: string };

function fail(reason: string): SvgValidation {
  return { ok: false, reason };
}

// Validate an uploaded SVG. Returns the (trimmed) original bytes on success.
export function validateSvgUpload(input: string): SvgValidation {
  const svg = input.trim();

  if (svg.length === 0) return fail("File is empty.");
  if (Buffer.byteLength(svg, "utf8") > MAX_SVG_BYTES) {
    return fail("SVG is too large (max 100 KB).");
  }

  // Analyze a copy with comments removed so commented-out markup neither hides
  // nor triggers false matches. (Stored output keeps the original bytes.)
  const scan = svg.replace(/<!--[\s\S]*?-->/g, "");

  // Block DOCTYPE / entity declarations (XXE + billion-laughs) and CDATA.
  const lower = scan.toLowerCase();
  if (lower.includes("<!doctype")) return fail("DOCTYPE is not allowed.");
  if (lower.includes("<!entity")) return fail("Entity declarations are not allowed.");
  if (lower.includes("<![cdata[")) return fail("CDATA sections are not allowed.");

  // Allow only a single leading <?xml …?> processing instruction; reject others.
  const withoutXmlDecl = scan.replace(/^\s*<\?xml[^>]*\?>/i, "");
  if (/<\?/.test(withoutXmlDecl)) {
    return fail("Processing instructions are not allowed.");
  }

  // Must actually be an SVG document.
  if (!/^\s*(?:<\?xml[^>]*\?>\s*)?<\s*svg[\s>]/i.test(scan)) {
    return fail("File does not start with an <svg> element.");
  }

  // Every element name must be on the allowlist (namespace prefix stripped).
  const tagRe = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9:_-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(scan)) !== null) {
    const raw = m[1].toLowerCase();
    const name = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : raw;
    if (!ALLOWED_ELEMENTS.has(name)) {
      return fail(`Disallowed element: <${m[1]}>.`);
    }
  }

  // No event handlers (onload, onclick, …).
  if (/(?:^|\s)on[a-z]+\s*=/i.test(scan)) {
    return fail("Inline event handlers are not allowed.");
  }

  // No inline styles (avoids url()/@import and expression vectors).
  if (/(?:^|\s)style\s*=/i.test(scan)) {
    return fail("Inline style attributes are not allowed.");
  }

  // No dangerous URI schemes anywhere.
  if (/javascript:/i.test(scan)) return fail("javascript: URIs are not allowed.");
  if (/\bdata:/i.test(scan)) return fail("data: URIs are not allowed.");

  // href / xlink:href must be local fragment refs only (e.g. url(#grad)).
  const hrefRe = /\b(?:xlink:)?href\s*=\s*("|')(.*?)\1/gi;
  while ((m = hrefRe.exec(scan)) !== null) {
    if (!m[2].trim().startsWith("#")) {
      return fail("External href references are not allowed.");
    }
  }
  // Unquoted href is rejected outright (can't be reliably bounded).
  if (/\b(?:xlink:)?href\s*=\s*[^"'\s>]/i.test(scan)) {
    return fail("Malformed href reference.");
  }

  // url(...) must reference a local fragment only.
  const urlRe = /url\(\s*('|")?\s*([^)'"]*)/gi;
  while ((m = urlRe.exec(scan)) !== null) {
    if (!m[2].trim().startsWith("#")) {
      return fail("External url() references are not allowed.");
    }
  }

  // Quality gate: an icon must have a viewBox so it scales at any size.
  if (!/\bviewBox\s*=/.test(scan)) {
    return fail("SVG must include a viewBox.");
  }

  return { ok: true, svg };
}
