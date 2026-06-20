import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

// Toggle a contact message's read flag. Admin only.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const o = await parseJson(req);
  if (typeof o.read !== "boolean") {
    return NextResponse.json({ error: "read must be a boolean" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_messages")
    .update({ read: o.read })
    .eq("id", id);
  if (error) {
    return serverError(error);
  }
  return NextResponse.json({ ok: true });
}

// Delete a contact message. Admin only.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_messages")
    .delete()
    .eq("id", id);
  if (error) {
    return serverError(error);
  }
  return NextResponse.json({ ok: true });
}
