import { NextResponse } from "next/server";

// Shared JSON error helpers for API route handlers.

// A consistent `{ error }` JSON response.
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type PgError = { code?: string | null; message?: string | null } | null;

/**
 * Map a Supabase/Postgres write error to a safe client response:
 *  - `23505` (unique_violation) → 409 with `conflictMessage` (safe + useful).
 *  - anything else → a generic 500 (the raw DB message is logged, never returned,
 *    so we don't leak schema/internal details to clients).
 */
export function mapPgError(
  error: PgError,
  conflictMessage = "That already exists.",
) {
  if (error?.code === "23505") return jsonError(conflictMessage, 409);
  console.error("[db] unexpected error:", error?.code, error?.message);
  return jsonError("Something went wrong. Please try again.", 500);
}

/**
 * Generic 500 for an unexpected server/DB error: logs the real error (so it lands
 * in the Worker logs / Cloudflare Observability) and returns a safe, generic
 * message — never the raw DB/internal text — to the client.
 */
export function serverError(
  error?: unknown,
  message = "Something went wrong. Please try again.",
) {
  if (error) console.error("[api] server error:", error);
  return jsonError(message, 500);
}
