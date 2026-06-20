import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getAllSeriesWithCounts } from "@/lib/series";
import { SeriesManager } from "@/components/SeriesManager";

export const metadata: Metadata = { title: "Series · Manage" };
export const dynamic = "force-dynamic";

export default async function ManageSeriesPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const series = await getAllSeriesWithCounts();

  return (
    <div>
      <p className="text-sm text-(--muted)">
        Add a series from the post editor (and set each post’s part number there).
        Renaming changes its URL slug; deleting removes posts from the series — it
        doesn’t delete posts.
      </p>
      <SeriesManager series={series} />
    </div>
  );
}
