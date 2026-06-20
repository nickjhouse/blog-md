// Shared, dependency-free comment config so both the edit API route and the
// client UI agree on the rules. (Kept separate from comments.ts, which imports
// the server Supabase client and can't be pulled into a client component.)

export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 5000;

// How long after posting a comment can still be edited by its author.
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const COMMENT_EDIT_WINDOW_LABEL = "15 minutes";

// True if a comment created at `createdAtISO` is still within the edit window.
export function withinEditWindow(createdAtISO: string): boolean {
  const created = new Date(createdAtISO).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= COMMENT_EDIT_WINDOW_MS;
}
