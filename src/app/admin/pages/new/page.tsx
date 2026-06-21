import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { PageEditor } from "@/components/PageEditor";
import { getSiteIdentity } from "@/lib/identity";

export const metadata: Metadata = { title: "New page" };
export const dynamic = "force-dynamic";

export default async function NewPagePage() {
  if (!(await getAdminContext())) redirect("/admin");
  const identity = await getSiteIdentity();
  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New page</h1>
        <Link
          href="/admin/pages"
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          ← Pages
        </Link>
      </div>
      <PageEditor
        mode="create"
        siteName={identity.name}
        contactEmail={identity.contactEmail}
        siteUrl={identity.url}
      />
    </section>
  );
}
