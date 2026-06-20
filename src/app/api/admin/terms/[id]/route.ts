import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

// Remove a custom filter term — admin only.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("moderation_terms")
    .delete()
    .eq("id", id);
  if (error) {
    return serverError(error);
  }
  return NextResponse.json({ ok: true });
}
