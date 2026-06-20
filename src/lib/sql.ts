// Escape LIKE / ILIKE wildcards so a user-supplied value is matched literally
// (still case-insensitively for ilike). Without this, a `%` or `_` in a URL
// segment acts as a wildcard — e.g. `/author/%` would match every row. Postgres
// uses backslash as the default LIKE escape character.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
