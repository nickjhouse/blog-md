// Small "or" divider between the password form and the Google button.
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-(--muted)">
      <span className="h-px flex-1 bg-(--border)" />
      or
      <span className="h-px flex-1 bg-(--border)" />
    </div>
  );
}
