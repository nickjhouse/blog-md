import { NextResponse } from "next/server";
import { getViewerContext } from "@/lib/auth";

// The caller's own session, for client-side hydration of per-user UI (nav,
// edit button, comment form) once those are decoupled from the server render.
// MUST stay dynamic + uncached — it's per-user by definition. Returns only
// non-sensitive identity/role fields (no email).
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewerContext();
  const body = viewer
    ? {
        userId: viewer.userId,
        displayName: viewer.displayName,
        isAdmin: viewer.isAdmin,
        isAuthor: viewer.isAuthor,
      }
    : null;
  return NextResponse.json(
    { session: body },
    { headers: { "Cache-Control": "no-store" } },
  );
}
