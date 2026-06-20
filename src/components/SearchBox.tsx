"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Simple search input that navigates to /search?q=… on submit. Kept controlled
// so it can be pre-filled with the current query on the results page.
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search posts…"
        aria-label="Search posts"
        className="min-w-0 flex-1 rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
      />
      <button
        type="submit"
        className="shrink-0 rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] "
      >
        Search
      </button>
    </form>
  );
}
