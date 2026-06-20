import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/enums";

export type AuthorOption = { id: string; display_name: string | null };

export type ManagedUser = {
  id: string;
  display_name: string | null;
  role: UserRole;
  is_blocked: boolean;
  created_at: string;
};

// All users with their role — for the admin /admin/users page. Admin-only;
// reads via the secret key.
export async function getAllUsersWithRoles(): Promise<ManagedUser[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_blocked, created_at")
    .order("created_at", { ascending: true });
  return data ?? [];
}

// Profiles that can be a post's author (author or admin), for the admin-only
// author/reassignment selector. Reads via the secret key.
export async function getAuthorOptions(): Promise<AuthorOption[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .in("role", ["author", "admin"])
    .order("display_name");
  const rows = data ?? [];
  return rows.map((r) => ({ id: r.id, display_name: r.display_name }));
}
