// Deterministic date formatting (fixed locale + UTC) so server-rendered output
// is stable and never causes hydration mismatches.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return dateFormatter.format(new Date(iso));
}
