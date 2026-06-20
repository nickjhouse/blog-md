import { redirect } from "next/navigation";

// Settings landing → first (and currently only built) tab.
export default function SettingsIndex() {
  redirect("/admin/settings/identity");
}
