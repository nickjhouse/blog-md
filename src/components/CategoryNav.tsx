import Link from "next/link";
import type { CategoryRef } from "@/lib/posts";

// Inline row of category links. `activeSlug` underlines the current category.
export function CategoryNav({
  categories,
  activeSlug,
}: {
  categories: CategoryRef[];
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-black/60 dark:text-white/60">
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/category/${c.slug}`}
          className={
            c.slug === activeSlug
              ? "font-medium text-(--accent) underline"
              : "hover:text-(--accent) hover:underline"
          }
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
