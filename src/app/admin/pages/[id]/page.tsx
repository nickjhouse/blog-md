import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getPageForAdmin } from "@/lib/pages";
import { PageEditor } from "@/components/PageEditor";

export const metadata: Metadata = { title: "Edit page" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditPagePage({ params }: { params: Params }) {
  if (!(await getAdminContext())) redirect("/admin");
  const { id } = await params;
  const page = await getPageForAdmin(id);
  if (!page) notFound();

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit page</h1>
        <Link
          href="/admin/pages"
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          ← Pages
        </Link>
      </div>
      <PageEditor mode="edit" initial={page} />
    </section>
  );
}
