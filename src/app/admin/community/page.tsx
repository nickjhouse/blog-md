import { redirect } from "next/navigation";

// Community landing → first tab.
export default function CommunityIndex() {
  redirect("/admin/community/moderation");
}
