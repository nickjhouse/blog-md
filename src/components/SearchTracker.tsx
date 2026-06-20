"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

// Fires a "search" event from the results page (so it captures both box
// submissions and direct/shared /search?q= visits), once per distinct query.
// Sends the normalized query + result count; no user identity is attached.
export function SearchTracker({
  query,
  results,
}: {
  query: string;
  results: number;
}) {
  const last = useRef<string | null>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase().slice(0, 120);
    if (!q || last.current === q) return;
    last.current = q;
    track("search", { query: q, results });
  }, [query, results]);

  return null;
}
