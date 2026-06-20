import { redirect } from "next/navigation";

// Moved into the Community hub. Kept as a redirect for old bookmarks/links.
export default function MovedModeration() {
  redirect("/admin/community/moderation");
}
