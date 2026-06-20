import { redirect } from "next/navigation";

// Manage landing → first tab.
export default function ManageIndex() {
  redirect("/admin/manage/categories");
}
