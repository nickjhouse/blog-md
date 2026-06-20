import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getSiteIdentity } from "@/lib/identity";
import { ThemeEditor } from "@/components/ThemeEditor";

export const metadata: Metadata = { title: "Theme · Settings" };
export const dynamic = "force-dynamic";

export default async function ThemeSettingsPage() {
  if (!(await getAdminContext())) redirect("/admin");

  const [s, identity] = await Promise.all([getSettings(), getSiteIdentity()]);
  return (
    <ThemeEditor
      overrides={s.theme_overrides}
      defaultOverrides={s.theme_default}
      ogName={identity.name}
      ogDescription={identity.description}
    />
  );
}
