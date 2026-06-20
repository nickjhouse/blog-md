import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getPageForAdmin } from "@/lib/pages";

export const metadata: Metadata = { title: "Preview page", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// Admin-only dynamic preview of a page — including disabled ones (the public
// /[slug] route is cached + enabled-only, so it can't show disabled pages). Uses
// the service-role read (getPageForAdmin) so it sees any page regardless of
// status. Renders the same markup the public page would.
export default async function PagePreview({ params }: { params: Params }) {
  if (!(await getAdminContext())) redirect("/admin");
  const { id } = await params;
  const page = await getPageForAdmin(id);
  if (!page) notFound();

  return (
    <article className="prose-content">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-(--accent) bg-(--hover) px-3 py-2 text-sm not-prose">
        <span>
          Preview — {page.enabled ? "this page is live" : "this page is disabled (not public)"}.
          {page.enabled ? (
            <>
              {" "}
              <Link href={`/${page.slug}`} className="underline">
                View live →
              </Link>
            </>
          ) : null}
        </span>
        <Link
          href={`/admin/pages/${page.id}`}
          className="shrink-0 underline"
        >
          Edit
        </Link>
      </div>
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        {page.title}
      </h1>
      <div dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
    </article>
  );
}
