// ============================================================================
// SITE CONFIG — single source of truth for the site's identity.
// Rebranding the blog (name, tagline, contact, base URL) is a one-file edit.
// Theme COLORS live in src/app/globals.css (the :root / .dark CSS variables).
// ============================================================================

export const siteConfig = {
  // Shown in the nav, footer, page titles, OG cards, RSS, etc.
  // (Admin-overridable at runtime via Settings → Identity.)
  name: "My Blog",
  // Default meta description + tagline.
  description: "A personal blog about… things.",
  // Public base URL — used for canonical links, Open Graph, sitemap, and the
  // RSS feed. Set per-environment via NEXT_PUBLIC_SITE_URL.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  // BCP-47 language tag for <html lang> and the RSS <language>.
  locale: "en",
  // Contact address shown on the privacy policy page.
  contactEmail: "contact@example.com",
} as const;

// ---- Derived helpers (don't edit; change the values above) ----

export const SITE_NAME = siteConfig.name;
export const SITE_URL = siteConfig.url;
export const SITE_DESCRIPTION = siteConfig.description;
export const SITE_LOCALE = siteConfig.locale;
export const CONTACT_EMAIL = siteConfig.contactEmail;

// Next metadata title template, e.g. "About · My Blog".
export const TITLE_TEMPLATE = `%s · ${siteConfig.name}`;

// Brand mark used for BOTH the browser favicon and the nav logo. To rebrand,
// replace public/brand/icon.svg and bump the ?v= number so browsers (which
// cache favicons aggressively) pick up the new file.
export const BRAND_ICON = "/brand/icon.svg?v=1";

// URL/filename-safe slug of the site name, e.g. "my-blog" (used for the
// export download filename).
export const SITE_SLUG = siteConfig.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
