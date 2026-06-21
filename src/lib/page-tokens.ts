import type { SiteIdentity } from "@/lib/identity";

// Tokens an admin can drop into ANY page or post body. They're substituted from
// live site settings at render time. Dependency-free.
export const PAGE_TOKENS: ReadonlyArray<{ token: string; label: string }> = [
  { token: "{{site_name}}", label: "Site name" },
  { token: "{{contact_email}}", label: "Contact email" },
  { token: "{{site_url}}", label: "Site URL" },
];

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

type TokenIdentity = Pick<SiteIdentity, "name" | "contactEmail" | "url">;

// Substitute tokens into sanitized page/post HTML (for dangerouslySetInnerHTML).
// Values are HTML-escaped so a stray "<" can't break/inject markup. Two safety
// properties:
//  - Expansion SKIPS <code> / <pre> regions, so code examples containing {{…}}
//    (common in technical posts) are left untouched.
//  - Also handles the percent-encoded form ("%7B%7B…%7D%7D") Markdown produces
//    inside link URLs (e.g. a mailto: href), so tokens work in links too.
export function renderPageTokens(
  html: string,
  identity: TokenIdentity,
): string {
  const name = escapeHtml(identity.name);
  const email = escapeHtml(identity.contactEmail);
  const url = escapeHtml(identity.url);
  const sub = (text: string): string =>
    text
      .replaceAll("{{site_name}}", name)
      .replaceAll("{{contact_email}}", email)
      .replaceAll("{{site_url}}", url)
      .replaceAll("%7B%7Bsite_name%7D%7D", name)
      .replaceAll("%7B%7Bcontact_email%7D%7D", email)
      .replaceAll("%7B%7Bsite_url%7D%7D", url);
  // split() with a capturing group keeps the code regions at odd indices.
  return html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/i)
    .map((part, i) => (i % 2 === 1 ? part : sub(part)))
    .join("");
}

// Plain-text token substitution for non-HTML contexts (e.g. <meta> description),
// where the framework already escapes the value — so we must NOT pre-escape here.
export function renderTokensPlain(
  text: string,
  identity: TokenIdentity,
): string {
  return text
    .replaceAll("{{site_name}}", identity.name)
    .replaceAll("{{contact_email}}", identity.contactEmail)
    .replaceAll("{{site_url}}", identity.url);
}
