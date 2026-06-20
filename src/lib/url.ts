// Returns the URL only if it's an absolute http(s) link — otherwise null. Used
// before rendering user-provided URLs (profile social links) as href, so a
// "javascript:"/"data:" value can never become a clickable link (XSS guard).
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}
