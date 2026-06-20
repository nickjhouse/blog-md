import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type SiteSettings = {
  require_comment_approval: boolean;
  notify_on_comment: boolean;
  rate_limit_seconds: number;
  max_links_per_comment: number;
  // Brand mark: null path = use the committed default icon.
  brand_icon_path: string | null;
  brand_icon_version: number;
  // Identity: null = fall back to site.config.ts defaults.
  site_name: string | null;
  site_description: string | null;
  contact_email: string | null;
  site_locale: string | null;
  // Theme: per-mode CSS-variable overrides; {} = globals.css defaults.
  theme_overrides: ThemeOverrides;
  // Saved theme snapshot the "Reset to default" button reverts to; {} = none.
  theme_default: ThemeOverrides;
  // Auto-newsletter: send on publish, and whether authors count too.
  auto_newsletter_on_publish: boolean;
  auto_newsletter_include_authors: boolean;
  // Admin-editable homepage intro blurb; null/empty = nothing rendered.
  home_intro: string | null;
  // Master toggle for the homepage intro section (independent of the text).
  home_intro_enabled: boolean;
  // Whether a bulk publish also fires the auto-newsletter (gated by the master
  // auto_newsletter_on_publish too). Off by default to avoid mass sends.
  bulk_publish_sends_newsletter: boolean;
  // Newsletter capture prompt (sticky corner card). trigger 'off' disables it.
  newsletter_prompt_trigger: NewsletterPromptTrigger;
  newsletter_prompt_scroll_pct: number;
  newsletter_prompt_delay_seconds: number;
  newsletter_prompt_redisplay_days: number;
  // Built-in Contact page on/off (form route + footer link + sitemap entry).
  contact_enabled: boolean;
};

export type NewsletterPromptTrigger = "off" | "scroll" | "time" | "exit";

// { light: { "--accent": "#…" }, dark: { … } } — only explicitly-set tokens.
export type ThemeOverrides = {
  light?: Record<string, string>;
  dark?: Record<string, string>;
};

// The safety-net defaults — also what a failed/unavailable read returns.
const DEFAULT_SETTINGS: SiteSettings = {
  require_comment_approval: false,
  notify_on_comment: true,
  rate_limit_seconds: 15,
  max_links_per_comment: 3,
  brand_icon_path: null,
  brand_icon_version: 0,
  site_name: null,
  site_description: null,
  contact_email: null,
  site_locale: null,
  theme_overrides: {},
  theme_default: {},
  auto_newsletter_on_publish: false,
  auto_newsletter_include_authors: false,
  home_intro: null,
  home_intro_enabled: false,
  bulk_publish_sends_newsletter: false,
  newsletter_prompt_trigger: "off",
  newsletter_prompt_scroll_pct: 50,
  newsletter_prompt_delay_seconds: 30,
  newsletter_prompt_redisplay_days: 30,
  contact_enabled: true,
};

// Settings are private (RLS blocks non-service-role), so read with the admin
// client. Safe to call from admin server components / routes and the
// (already service-role) comment route.
//
// Fail-safe: returns DEFAULT_SETTINGS on ANY error. This is what keeps the read
// from throwing when the secret key is absent (e.g. build-time prerendering of
// static pages, where createAdminClient() would otherwise throw) and hardens
// every page against a transient settings-read failure. Code defaults are the
// safety net, so defaulting here is consistent + safe.
export async function getSettings(): Promise<SiteSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("site_settings")
      .select(
        "require_comment_approval, notify_on_comment, rate_limit_seconds, max_links_per_comment, brand_icon_path, brand_icon_version, site_name, site_description, contact_email, site_locale, theme_overrides, theme_default, auto_newsletter_on_publish, auto_newsletter_include_authors, home_intro, home_intro_enabled, bulk_publish_sends_newsletter, newsletter_prompt_trigger, newsletter_prompt_scroll_pct, newsletter_prompt_delay_seconds, newsletter_prompt_redisplay_days, contact_enabled",
      )
      .eq("id", true)
      .maybeSingle();
    return {
      require_comment_approval: data?.require_comment_approval ?? false,
      notify_on_comment: data?.notify_on_comment ?? true,
      rate_limit_seconds: data?.rate_limit_seconds ?? 15,
      max_links_per_comment: data?.max_links_per_comment ?? 3,
      brand_icon_path: data?.brand_icon_path ?? null,
      brand_icon_version: data?.brand_icon_version ?? 0,
      site_name: data?.site_name ?? null,
      site_description: data?.site_description ?? null,
      contact_email: data?.contact_email ?? null,
      site_locale: data?.site_locale ?? null,
      theme_overrides: (data?.theme_overrides as ThemeOverrides | undefined) ?? {},
      theme_default: (data?.theme_default as ThemeOverrides | undefined) ?? {},
      auto_newsletter_on_publish: data?.auto_newsletter_on_publish ?? false,
      auto_newsletter_include_authors:
        data?.auto_newsletter_include_authors ?? false,
      home_intro: data?.home_intro ?? null,
      home_intro_enabled: data?.home_intro_enabled ?? false,
      bulk_publish_sends_newsletter:
        data?.bulk_publish_sends_newsletter ?? false,
      newsletter_prompt_trigger:
        (data?.newsletter_prompt_trigger as NewsletterPromptTrigger | undefined) ??
        "off",
      newsletter_prompt_scroll_pct: data?.newsletter_prompt_scroll_pct ?? 50,
      newsletter_prompt_delay_seconds:
        data?.newsletter_prompt_delay_seconds ?? 30,
      newsletter_prompt_redisplay_days:
        data?.newsletter_prompt_redisplay_days ?? 30,
      contact_enabled: data?.contact_enabled ?? true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Per-request memoized read so the layout, generateMetadata, the nav, and any
// page reading settings in the same request share a single DB round-trip.
export const getSettingsCached = cache(getSettings);

export async function updateSettings(
  patch: Partial<SiteSettings>,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("site_settings").update(patch).eq("id", true);
}
