import { createAdminClient } from "@/lib/supabase/admin";

// Read + aggregate custom events for the admin dashboard. Reads go through the
// secret-key client (RLS is locked on analytics_events), so only ever call this
// from an admin-guarded server component.

export type AnalyticsSummary = {
  total: number;
  byName: { name: string; count: number }[];
  shareByNetwork: { network: string; count: number }[];
  topSearches: { query: string; count: number }[];
  zeroResultSearches: { query: string; count: number }[];
  recent: { name: string; path: string | null; created_at: string }[];
  days: number;
};

export async function getAnalyticsSummary(days = 30): Promise<AnalyticsSummary> {
  // DB-side aggregation via RPC (one round-trip) instead of pulling up to 5000
  // rows and counting in JS — the old cap silently undercounted busy windows.
  // See migration 0042 (analytics_summary).
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("analytics_summary", {
    p_days: days,
  });
  if (error) throw error;
  const s = (data ?? {}) as Partial<Omit<AnalyticsSummary, "days">>;
  return {
    total: s.total ?? 0,
    byName: s.byName ?? [],
    shareByNetwork: s.shareByNetwork ?? [],
    topSearches: s.topSearches ?? [],
    zeroResultSearches: s.zeroResultSearches ?? [],
    recent: s.recent ?? [],
    days,
  };
}
