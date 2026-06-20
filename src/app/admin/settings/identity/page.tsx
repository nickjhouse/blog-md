import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { siteConfig } from "@/lib/site.config";
import { IdentitySettingsForm } from "@/components/IdentitySettingsForm";

export const metadata: Metadata = { title: "Identity · Settings" };
export const dynamic = "force-dynamic";

export default async function IdentitySettingsPage() {
  if (!(await getAdminContext())) redirect("/admin");

  const s = await getSettings();
  return (
    <IdentitySettingsForm
      current={{
        site_name: s.site_name,
        site_description: s.site_description,
        contact_email: s.contact_email,
        site_locale: s.site_locale,
        home_intro: s.home_intro,
        home_intro_enabled: s.home_intro_enabled,
      }}
      defaults={{
        name: siteConfig.name,
        description: siteConfig.description,
        contactEmail: siteConfig.contactEmail,
        locale: siteConfig.locale,
      }}
    />
  );
}
