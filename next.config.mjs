// Content-Security-Policy + security headers for SSR/Worker responses.
// IMPORTANT: on Cloudflare Workers, public/_headers only applies to STATIC
// assets, not Worker-rendered pages — so page-level security headers must be set
// here (Next applies these to all routes it serves). 'unsafe-inline' is required
// for scripts/styles because Next injects inline bootstrap scripts + we render an
// inline theme <style>; a static header file can't issue per-request nonces.
//
// On 'unsafe-inline' (script-src): this is an ACCEPTED, not an oversight.
// Removing it needs per-request nonces, which are incompatible with the
// static/ISR pages (a nonce baked into cached HTML is reused constant =
// no security gain), and Next's per-page streaming inline scripts can't
// be hashed either. The real XSS vectors are already closed upstream
// (rehype-sanitize on user HTML, the SVG-upload validator) and the directives
// below stay strict, so this is a missing defense-in-depth layer, not an open
// hole.
// `next dev` (webpack HMR + eval source maps) runs modules via eval(), which
// needs 'unsafe-eval'. Production builds do NOT use eval, so we keep prod strict
// and only relax this in development.
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  // blob: is needed for the image cropper's object-URL preview (avatar/cover/OG).
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  // challenges.cloudflare.com = Cloudflare Turnstile (script + iframe + verify).
  // *.sentry-cdn.com = Sentry browser Loader Script (lazy-loads the SDK bundle).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com https://challenges.cloudflare.com https://js.sentry-cdn.com https://browser.sentry-cdn.com`,
  // *.sentry.io = Sentry event ingestion endpoint.
  "connect-src 'self' https://*.supabase.co https://cloudflareinsights.com https://challenges.cloudflare.com https://*.sentry.io",
  "frame-src https://challenges.cloudflare.com",
  "font-src 'self' data:",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Forms may only submit back to your own origin — blocks form-based data
  // exfiltration if markup were ever injected. Verified safe: every form is
  // same-origin or JS fetch; OAuth/reset/signup use same-origin redirects, not
  // cross-origin form posts.
  "form-action 'self'",
  // Upgrade any stray http subresource to https. Prod only — it would try to
  // upgrade the http://localhost dev server and break local development.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow images served from Supabase Storage. Replace <project-ref> via env at runtime if needed.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

// Integrate the OpenNext Cloudflare adapter with `next dev` so Cloudflare
// bindings work during local development.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
