import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getModerationTerms } from "@/lib/terms";
import { CommentsSettings } from "@/components/CommentsSettings";

export const metadata: Metadata = { title: "Comments · Settings" };
export const dynamic = "force-dynamic";

export default async function CommentsSettingsPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const [settings, terms] = await Promise.all([
    getSettings(),
    getModerationTerms(),
  ]);
  return <CommentsSettings settings={settings} terms={terms} />;
}
