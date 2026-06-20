// Small "or" divider between the password form and the Google button.
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-[color:var(--muted)]">
      <span className="h-px flex-1 bg-[color:var(--border)]" />
      or
      <span className="h-px flex-1 bg-[color:var(--border)]" />
    </div>
  );
}
