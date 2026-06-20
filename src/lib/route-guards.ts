import { NextResponse, type NextRequest } from "next/server";
import {
  getContributorContext,
  getAdminContext,
  type ContributorContext,
  type AdminContext,
} from "@/lib/auth";

// Shared preamble helpers for admin API route handlers (see REFACTOR-REVIEW R3).
// The guards return EITHER the auth context OR a NextResponse the handler should
// return as-is: `const me = await requireContributor(); if (me instanceof
// NextResponse) return me;` — after that check, `me` is narrowed to the context.

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

// Gate: contributors (authors + admins).
export async function requireContributor(): Promise<
  ContributorContext | NextResponse
> {
  const me = await getContributorContext();
  return me ?? forbidden();
}

// Gate: admins only.
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  const me = await getAdminContext();
  return me ?? forbidden();
}

// Parse a JSON request body, tolerating malformed/empty bodies → `{}`.
export async function parseJson<T = Record<string, unknown>>(
  req: NextRequest,
): Promise<T> {
  return ((await req.json().catch(() => null)) ?? {}) as T;
}

// Per-post ownership: authors may only act on their own posts; admins on any.
// Returns a 403 response when the actor isn't allowed, else null.
export function assertPostOwnership(
  row: { author_id: string | null },
  me: { userId: string; isAdmin: boolean },
): NextResponse | null {
  if (!me.isAdmin && row.author_id !== me.userId) return forbidden();
  return null;
}
