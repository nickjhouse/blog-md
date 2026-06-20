import { redirect } from "next/navigation";

// Users moved from the Manage hub into the Community hub. Kept as a redirect for
// old bookmarks/links.
export default function MovedManageUsers() {
  redirect("/admin/community/users");
}
