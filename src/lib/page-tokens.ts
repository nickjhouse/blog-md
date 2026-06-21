import type { SiteIdentity } from "@/lib/identity";

// Tokens an admin can drop into ANY CMS page body. They're substituted from live
// site settings when the page renders, so e.g. a Privacy Policy keeps showing the
// current site name / contact email without a manual edit. Dependency-free.
export const PAGE_TOKENS: ReadonlyArray<{ token: string; label: string }> = [
  { token: "{{site_name}}", label: "Site name" },
  { token: "{{contact_email}}", label: "Contact email" },
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

// Substitute tokens into sanitized page HTML (for dangerouslySetInnerHTML).
// Values are HTML-escaped so a stray "<" in a site name can't break/inject
// markup. We also handle the percent-encoded token form ("%7B%7B…%7D%7D") that
// Markdown produces inside link URLs (e.g. a `mailto:` href), so tokens work in
// links too — not just text.
export function renderPageTokens(
  html: string,
  identity: Pick<SiteIdentity, "name" | "contactEmail">,
): string {
  const name = escapeHtml(identity.name);
  const email = escapeHtml(identity.contactEmail);
  return html
    .replaceAll("{{site_name}}", name)
    .replaceAll("{{contact_email}}", email)
    .replaceAll("%7B%7Bsite_name%7D%7D", name)
    .replaceAll("%7B%7Bcontact_email%7D%7D", email);
}

// Plain-text token substitution for non-HTML contexts (e.g. <meta> description),
// where the framework already escapes the value — so we must NOT pre-escape here.
export function renderTokensPlain(
  text: string,
  identity: Pick<SiteIdentity, "name" | "contactEmail">,
): string {
  return text
    .replaceAll("{{site_name}}", identity.name)
    .replaceAll("{{contact_email}}", identity.contactEmail);
}
