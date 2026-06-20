import { NextResponse } from "next/server";
import { getViewerContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFromAudience } from "@/lib/newsletter";

// Self-serve account deletion. Authorized by the session, so a user can ONLY
// delete their own account. Password re-auth is performed client-side (mirroring
// the login form, which redeems the Turnstile token reliably in the browser);
// this route trusts the verified session. Deleting the auth user cascades
// (ON DELETE CASCADE) to profile, comments, reactions, bookmarks, and reports;
// authored posts are kept (posts.author_id is ON DELETE SET NULL → byline falls
// back to the site).
export const dynamic = "force-dynamic";

export async function POST() {
  const viewer = await getViewerContext();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = createAdminClient();

  // Last-admin guard: never let the site delete its only admin.
  if (viewer.isAdmin) {
    const { count } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error:
            "You’re the only admin — assign another admin before deleting your account.",
        },
        { status: 409 },
      );
    }
  }

  // Email is needed only to purge the Resend newsletter contact afterward.
  const { data: authUser } = await db.auth.admin.getUserById(viewer.userId);
  const email = authUser?.user?.email ?? null;

  // Delete the auth user; the DB cascade removes their data.
  const { error: delError } = await db.auth.admin.deleteUser(viewer.userId);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  // Best-effort: also purge the email from the Resend newsletter audience.
  // The account is already gone, so a Resend failure must not fail the request.
  if (email) await removeFromAudience(email).catch(() => {});

  return NextResponse.json({ ok: true });
}
