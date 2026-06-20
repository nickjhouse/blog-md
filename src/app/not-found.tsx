import Link from "next/link";

// Themed 404. Renders inside the root layout (nav + footer + <main>), so this is
// just the page body — it inherits the site's fonts, colors, and theme overrides.
export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="font-serif text-6xl font-bold tracking-tight text-(--accent)">
        404
      </p>
      <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-(--muted)">
        The page you’re looking for doesn’t exist or may have been moved.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg)"
        >
          Back to home
        </Link>
        <Link
          href="/search"
          className="rounded-md border border-(--border-strong) px-4 py-2 text-sm hover:bg-(--hover)"
        >
          Search the site
        </Link>
      </div>
    </div>
  );
}
