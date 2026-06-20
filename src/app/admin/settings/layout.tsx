import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/auth";
import { SettingsTabs } from "@/components/SettingsTabs";

// Admin-only settings area. The /admin layout only gates contributors, so
// re-check admin here (each /api/admin/* route re-checks independently too).
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getAdminContext())) redirect("/admin");

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link
          href="/admin"
          className="text-sm text-(--muted) hover:underline"
        >
          ← Posts
        </Link>
      </div>
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </section>
  );
}
