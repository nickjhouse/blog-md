import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { resolveBrandIcon } from "@/lib/brand";
import { BrandMarkEditor } from "@/components/BrandMarkEditor";

export const metadata: Metadata = { title: "Brand mark · Settings" };
export const dynamic = "force-dynamic";

export default async function BrandSettingsPage() {
  if (!(await getAdminContext())) redirect("/admin");

  const settings = await getSettings();
  return (
    <BrandMarkEditor
      currentUrl={resolveBrandIcon(settings)}
      isCustom={settings.brand_icon_path !== null}
    />
  );
}
