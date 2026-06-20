import { createAdminClient } from "@/lib/supabase/admin";
import type { CustomTerms } from "@/lib/profanity";

export type ModerationTerm = {
  id: string;
  term: string;
  kind: "block" | "allow";
};

// Full list for the admin dashboard.
export async function getModerationTerms(): Promise<ModerationTerm[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("moderation_terms")
    .select("id, term, kind")
    .order("kind")
    .order("term");
  return data ?? [];
}

// Block/allow word arrays for the profanity filter (comment route).
export async function getModerationTermsForFilter(): Promise<CustomTerms> {
  const admin = createAdminClient();
  const { data } = await admin.from("moderation_terms").select("term, kind");
  const rows = data ?? [];
  return {
    block: rows.filter((r) => r.kind === "block").map((r) => r.term),
    allow: rows.filter((r) => r.kind === "allow").map((r) => r.term),
  };
}
