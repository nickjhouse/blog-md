import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getAllUsersWithRoles } from "@/lib/users";
import { UsersManager } from "@/components/UsersManager";

export const metadata: Metadata = { title: "Users · Community" };
export const dynamic = "force-dynamic";

export default async function UsersTab() {
  // The layout already gated admin; re-fetch here for the current user id.
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");

  const users = await getAllUsersWithRoles();

  return (
    <div>
      <p className="text-sm text-[color:var(--muted)]">
        Set roles: <strong>author</strong> can write and manage their own posts;{" "}
        <strong>admin</strong> manages everything. The only admin can’t be
        demoted. Blocking users is on the Moderation tab.
      </p>
      <UsersManager users={users} currentUserId={admin.userId} />
    </div>
  );
}
