import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { listPages } from "@/lib/pages";
import { getSettings } from "@/lib/settings";
import { PagesAdmin } from "@/components/PagesAdmin";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function PagesPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const [pages, settings] = await Promise.all([listPages(), getSettings()]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pages</h1>
        <Link
          href="/admin"
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          ← Posts
        </Link>
      </div>
      <PagesAdmin pages={pages} contactEnabled={settings.contact_enabled} />
    </section>
  );
}
