import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

// Block or unblock a user from commenting — admin only. Writes the is_blocked
// privilege field, which only the service role can change.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const me = await requireAdmin();
  if (me instanceof NextResponse) return me;
  if (id === me.userId) {
    return NextResponse.json(
      { error: "You can’t block yourself." },
      { status: 400 },
    );
  }

  const o = await parseJson(req);
  const blocked = o.blocked === true;

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      is_blocked: blocked,
      blocked_at: blocked ? new Date().toISOString() : null,
      blocked_reason: null,
    })
    .eq("id", id);
  if (error) {
    return serverError(error);
  }
  return NextResponse.json({ ok: true });
}
