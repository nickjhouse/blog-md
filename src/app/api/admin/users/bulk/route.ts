import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Bulk block / unblock users from commenting — admin only. Mirrors the single
// block endpoint (writes is_blocked + blocked_at, clears blocked_reason) but for
// many ids at once. The acting admin is always excluded so you can't block
// yourself, even if your row somehow ends up in the set.
export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (me instanceof NextResponse) return me;

  const o = await parseJson(req);
  const ids = Array.isArray(o.ids)
    ? [...new Set(o.ids.filter((v): v is string => typeof v === "string"))]
    : [];
  const blocked = o.blocked === true;

  const targetIds = ids.filter((id) => id !== me.userId);
  if (!targetIds.length) {
    return NextResponse.json({ error: "No users selected." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      is_blocked: blocked,
      blocked_at: blocked ? new Date().toISOString() : null,
      blocked_reason: null,
    })
    .in("id", targetIds);
  if (error) return serverError(error);

  return NextResponse.json({ ok: true });
}
