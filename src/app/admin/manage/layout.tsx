import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/auth";
import { ManageTabs } from "@/components/ManageTabs";

// Admin-only management hub (categories, series, users). The /admin layout only
// gates contributors, so re-check admin here (each /api/admin/* route re-checks
// independently too).
export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getAdminContext())) redirect("/admin");

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage</h1>
        <Link
          href="/admin"
          className="text-sm text-[color:var(--muted)] hover:underline"
        >
          ← Posts
        </Link>
      </div>
      <ManageTabs />
      <div className="mt-6">{children}</div>
    </section>
  );
}
