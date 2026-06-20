import Link from "next/link";
import type { SeriesForPost } from "@/lib/series";

// Shown on a post that belongs to a series: "Part N of M" + the ordered parts,
// with the current one highlighted.
export function SeriesNav({
  series,
  currentSlug,
}: {
  series: SeriesForPost;
  currentSlug: string;
}) {
  const total = series.parts.length;
  if (total === 0) return null;
  const idx = series.parts.findIndex((p) => p.slug === currentSlug);
  const part = idx >= 0 ? idx + 1 : null;

  return (
    <aside className="mt-6 rounded-xl border border-(--border) bg-(--surface) p-4">
      <div className="text-xs text-(--muted)">
        {part ? `Part ${part} of ${total} · ` : ""}
        <Link
          href={`/series/${series.slug}`}
          className="text-(--accent) hover:underline"
        >
          {series.title}
        </Link>
      </div>
      <ol className="mt-2 space-y-1 text-sm">
        {series.parts.map((p, i) => (
          <li key={p.slug} className="flex gap-2">
            <span className="text-(--muted)">{i + 1}.</span>
            {p.slug === currentSlug ? (
              <span className="font-medium">{p.title}</span>
            ) : (
              <Link
                href={`/post/${p.slug}`}
                prefetch={false}
                className="hover:underline"
              >
                {p.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
