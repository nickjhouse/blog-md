import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getCategoriesWithCounts } from "@/lib/posts";
import { CategoryManager } from "@/components/CategoryManager";

export const metadata: Metadata = { title: "Categories · Manage" };
export const dynamic = "force-dynamic";

export default async function ManageCategoriesPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const categories = await getCategoriesWithCounts();

  return (
    <div>
      <p className="text-sm text-(--muted)">
        Add categories from the post editor. Deleting one leaves its posts
        uncategorized — it doesn’t delete posts.
      </p>
      <CategoryManager categories={categories} />
    </div>
  );
}
