// Shared admin search input — a styled text field with a magnifier icon so it
// reads unmistakably as "search" (and never gets confused with a create/add
// field). Presentational only; the parent owns the query state.
export function AdminSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted)"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-(--border) bg-transparent py-2 pl-9 pr-3 text-sm outline-hidden focus:border-(--border-strong)"
      />
    </div>
  );
}
