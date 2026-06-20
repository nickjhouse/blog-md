import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedSeries } from "@/lib/series";

export const metadata: Metadata = {
  title: "Series",
  alternates: { canonical: "/series" },
};
export const dynamic = "force-dynamic";

export default async function SeriesIndexPage() {
  const series = await getPublishedSeries();

  return (
    <section>
      <h1 className="font-serif text-3xl font-bold tracking-tight">Series</h1>
      <p className="mt-2 text-sm text-(--muted)">
        Multi-part collections of posts.
      </p>

      <div className="mt-6">
        {series.length === 0 ? (
          <p className="text-(--muted)">No series yet.</p>
        ) : (
          series.map((s) => (
            <article
              key={s.id}
              className="border-t border-(--border) py-5"
            >
              <h2 className="font-serif text-xl font-semibold tracking-tight">
                <Link href={`/series/${s.slug}`} className="hover:underline">
                  {s.title}
                </Link>
              </h2>
              <div className="mt-0.5 text-xs text-(--muted)">
                {s.published} part{s.published === 1 ? "" : "s"}
              </div>
              {s.description ? (
                <p className="mt-1 text-(--muted)">{s.description}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
