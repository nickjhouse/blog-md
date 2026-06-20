import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/api-error";
import type { UserRole } from "@/lib/supabase/enums";

type Ctx = { params: Promise<{ id: string }> };

const ROLES: UserRole[] = ["reader", "author", "admin"];

// Admin-only: set a user's role. Refuses to demote the last remaining admin so
// the site can never be locked out of its admin tools.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const role = ROLES.includes(o.role as UserRole) ? (o.role as UserRole) : null;
  if (!role) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Last-admin guard: don't allow demoting the only admin.
  if ((target as { role: UserRole }).role === "admin" && role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Can’t change the only admin’s role." },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);
  if (error) {
    return serverError(error);
  }
  return NextResponse.json({ ok: true, role });
}
