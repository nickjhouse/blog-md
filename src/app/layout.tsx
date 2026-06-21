import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { hasPublishedSeries } from "@/lib/series";
import { SiteNav } from "@/components/SiteNav";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { NewsletterPrompt } from "@/components/NewsletterPrompt";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SessionProvider } from "@/components/SessionProvider";
import { siteConfig } from "@/lib/site.config";
import { getSettingsCached } from "@/lib/settings";
import { brandLogoUrl, brandIconMimeType } from "@/lib/brand";
import { getSiteIdentity } from "@/lib/identity";
import { getFooterPages } from "@/lib/pages";
import { resolveThemeStyles } from "@/lib/theme";
import { ThemeManager } from "@/components/ThemeManager";

const serif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

const cfAnalyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

// The layout is now cookie-free (per-user nav is client-side via SessionProvider
// → /api/me), so it no longer forces every route dynamic — the prerequisite for
// caching public pages. Each route opts in: post pages set `revalidate` (ISR via
// the R2 cache); every other public route keeps `force-dynamic`; auth/admin
// pages are dynamic via their cookie reads. The layout's settings reads
// (getSettings/getSiteIdentity) already fail safe to defaults, and
// getFooterPages/hasPublishedSeries now do too, so a build-time prerender of the
// shell (e.g. /_not-found) can't crash.

export async function generateMetadata(): Promise<Metadata> {
  // Cached reads — shared with the layout below (single DB round-trip/request).
  const [settings, identity] = await Promise.all([
    getSettingsCached(),
    getSiteIdentity(),
  ]);
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: identity.name,
      template: identity.titleTemplate,
    },
    description: identity.description,
    icons: {
      icon: [
        {
          url: brandLogoUrl(settings),
          type: brandIconMimeType(settings),
        },
      ],
    },
    alternates: {
      canonical: "/",
      types: { "application/rss+xml": "/feed.xml" },
    },
    openGraph: {
      type: "website",
      siteName: identity.name,
      title: identity.name,
      description: identity.description,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: identity.name,
      description: identity.description,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: the nav's per-user state is now client-driven (SessionProvider →
  // /api/me), so the layout no longer reads the auth cookie at render — the
  // prerequisite for caching public pages. (force-dynamic still set for now;
  // removed when ISR is enabled.)
  const [showSeriesLink, settings, identity, footerPages] = await Promise.all([
    hasPublishedSeries(),
    getSettingsCached(),
    getSiteIdentity(),
    getFooterPages(),
  ]);
  const brandIconUrl = brandLogoUrl(settings);
  const themeCss = resolveThemeStyles(settings.theme_overrides);
  // Sentry browser Loader Script (client-side error capture). Inert unless the
  // loader URL is configured. Error-only config (no perf/replay) to stay within
  // the free quota. Server errors are handled separately (instrumentation.ts).
  const sentryLoaderUrl = process.env.NEXT_PUBLIC_SENTRY_LOADER_URL;

  return (
    <html lang={identity.locale} suppressHydrationWarning>
      {/* NOTE: no className on <html>. The theme script sets `.dark` on <html>
          at runtime; if React managed <html>'s className it would re-apply the
          JSX value (without `.dark`) on the not-found / error-fallback render and
          strip the theme. The font-variable class lives on <body> instead. */}
      <head>
        {/* Admin theme overrides. Doubled selectors in the CSS beat the base
            :root/.dark rules in globals.css without !important. Only emitted
            when something differs from the defaults. */}
        {themeCss ? (
          <style
            id="theme-overrides"
            dangerouslySetInnerHTML={{ __html: themeCss }}
          />
        ) : null}
        {/* Sentry browser error capture (config must be defined before the
            loader runs; error-only to conserve the free quota). */}
        {sentryLoaderUrl ? (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html:
                  "window.sentryOnLoad=function(){Sentry.init({tracesSampleRate:0,replaysSessionSampleRate:0,replaysOnErrorSampleRate:0});};",
              }}
            />
            <script src={sentryLoaderUrl} crossOrigin="anonymous" async />
          </>
        ) : null}
      </head>
      <body
        className={`${serif.variable} min-h-screen antialiased`}
        suppressHydrationWarning
      >
        {/* Pre-paint theme bootstrap. Rendered as the FIRST <body> child rather
            than in a hand-written <head>, because Next builds the not-found
            page's <head> from metadata only and drops layout <head> children
            into the body — so a head-placed script never runs before paint on a
            404. As the first body child it's in the SSR HTML for every route
            (incl. not-found) and sets .dark + color-scheme before content paints
            (color-scheme keeps the canvas dark even in the sub-frame gap). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        {/* React-owned safety net: re-asserts the theme before paint on mount +
            every route change, so the not-found/error render can't strand the
            page in the wrong theme even if the inline script's class is dropped. */}
        <ThemeManager />
        <ScrollToTop />
        {/* Client session context (hydrates from /api/me). Mounted now as the
            foundation for decoupling per-user UI from the server render; nothing
            consumes it yet, so rendered output is unchanged. */}
        <SessionProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-(--border) focus:bg-(--surface) focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <header className="border-b border-(--border)">
          <SiteNav brandIconUrl={brandIconUrl} siteName={identity.name} />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-3xl px-4 py-8 focus:outline-hidden"
        >
          {children}
        </main>
        <footer className="mx-auto max-w-3xl px-4 py-10 text-sm text-(--muted)">
          <div className="max-w-sm">
            <NewsletterSignup />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-(--border) pt-4">
            <span>
              © {new Date().getFullYear()} {identity.name}
            </span>
            <div className="flex items-center gap-4">
              {showSeriesLink ? (
                <Link
                  href="/series"
                  className="hover:text-(--foreground)"
                >
                  Series
                </Link>
              ) : null}
              {footerPages.map((p) => (
                <Link
                  key={p.slug}
                  href={`/${p.slug}`}
                  className="hover:text-(--foreground)"
                >
                  {p.title}
                </Link>
              ))}
              {settings.contact_enabled ? (
                <Link
                  href="/contact"
                  className="hover:text-(--foreground)"
                >
                  Contact
                </Link>
              ) : null}
              <a
                href="/feed.xml"
                className="hover:text-(--foreground)"
              >
                RSS
              </a>
            </div>
          </div>
        </footer>
        {settings.newsletter_prompt_trigger !== "off" ? (
          <NewsletterPrompt
            trigger={settings.newsletter_prompt_trigger}
            scrollPct={settings.newsletter_prompt_scroll_pct}
            delaySeconds={settings.newsletter_prompt_delay_seconds}
            redisplayDays={settings.newsletter_prompt_redisplay_days}
          />
        ) : null}
        </SessionProvider>
        {cfAnalyticsToken ? (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${cfAnalyticsToken}"}`}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
