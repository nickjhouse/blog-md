import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { NewsletterSettings } from "@/components/NewsletterSettings";

export const metadata: Metadata = { title: "Newsletter · Settings" };
export const dynamic = "force-dynamic";

export default async function NewsletterSettingsPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const settings = await getSettings();
  return <NewsletterSettings settings={settings} />;
}
