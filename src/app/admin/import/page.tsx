import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { ImportPosts } from "@/components/ImportPosts";

export const metadata: Metadata = { title: "Import" };

export default async function AdminImportPage() {
  if (!(await getAdminContext())) redirect("/admin");
  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import posts</h1>
        <Link
          href="/admin"
          className="text-sm text-[color:var(--muted)] hover:underline"
        >
          ← Posts
        </Link>
      </div>
      <ImportPosts />
    </section>
  );
}
