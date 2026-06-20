import { cache } from "react";
import { siteConfig } from "@/lib/site.config";
import { getSettingsCached } from "@/lib/settings";
import { slugify } from "@/lib/slug";
import { isValidLocale } from "@/lib/locales";

export type SiteIdentity = {
  name: string;
  description: string;
  locale: string;
  contactEmail: string;
  url: string; // from site.config/env — never a DB setting
  titleTemplate: string; // `%s · ${name}`
  slug: string; // slugify(name) — used for the export filename
  homeIntro: string; // admin-editable homepage blurb; "" = none
  homeIntroEnabled: boolean; // master toggle for the homepage intro section
};

// Resolved site identity: DB overrides merged over the code defaults. Wraps the
// per-request cached settings read, so it shares one DB round-trip with the
// brand resolver and anything else reading settings in the same request.
export const getSiteIdentity = cache(async (): Promise<SiteIdentity> => {
  const s = await getSettingsCached();
  const name = s.site_name?.trim() || siteConfig.name;
  const description = s.site_description?.trim() || siteConfig.description;
  const contactEmail = s.contact_email?.trim() || siteConfig.contactEmail;
  const locale =
    s.site_locale && isValidLocale(s.site_locale)
      ? s.site_locale
      : siteConfig.locale;
  return {
    name,
    description,
    locale,
    contactEmail,
    url: siteConfig.url,
    titleTemplate: `%s · ${name}`,
    slug: slugify(name) || "site",
    homeIntro: s.home_intro?.trim() || "",
    homeIntroEnabled: s.home_intro_enabled,
  };
});
