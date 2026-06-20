import { createAdminClient } from "@/lib/supabase/admin";
import { sendErrorAlert } from "@/lib/email";

// Per-fingerprint email cooldown: an ongoing error alerts at most once per hour.
const COOLDOWN_MS = 60 * 60 * 1000;
// Global ceiling: never email about more than this many distinct errors per
// hour, so a flood of *different* errors still can't run up Resend sends.
const MAX_EMAILS_PER_HOUR = 10;

type ReportInput = {
  error: unknown;
  route?: string | null;
};

// Stable, low-cardinality fingerprint: route + error type + message, normalized
// to drop volatile bits (uuids, numbers) so the same bug collapses to one
// row/alert rather than thousands.
function fingerprintOf(name: string, message: string, route: string | null): string {
  const norm = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\d+/g, "<n>")
    .slice(0, 200);
  return `${route ?? "-"}|${name}: ${norm}`.slice(0, 300);
}

// Central server-error reporter. Always logs to the Worker console (Cloudflare
// Observability captures it); emails the owner only through a DB-backed throttle
// so a sustained error can't spam Resend. Best-effort throughout — never throws.
export async function reportServerError({ error, route = null }: ReportInput): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const name = err.name || "Error";
  const message = err.message || "(no message)";

  // Always log — the reliable record regardless of email throttling.
  console.error(`[error-report]${route ? ` ${route}` : ""} ${name}: ${message}`, err.stack);

  const fingerprint = fingerprintOf(name, message, route);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  try {
    const admin = createAdminClient();

    // Atomic occurrence record (insert or increment), returning current state.
    const { data, error: rpcErr } = await admin.rpc("record_error_alert", {
      p_fingerprint: fingerprint,
    });
    if (rpcErr) throw rpcErr;
    const rec = Array.isArray(data) ? data[0] : data;
    const occurrences = rec?.occurrences ?? 1;
    const firstSeen = rec?.first_seen ?? nowIso;
    const lastEmailedAt = rec?.last_emailed_at ?? null;

    // Per-fingerprint cooldown — already counted by the RPC, so just stop.
    if (lastEmailedAt && nowMs - new Date(lastEmailedAt).getTime() < COOLDOWN_MS) {
      return;
    }

    // Global hourly cap across all fingerprints.
    const sinceIso = new Date(nowMs - COOLDOWN_MS).toISOString();
    const { count } = await admin
      .from("error_alerts")
      .select("fingerprint", { count: "exact", head: true })
      .gte("last_emailed_at", sinceIso);
    if ((count ?? 0) >= MAX_EMAILS_PER_HOUR) return;

    // Send, then stamp last_emailed_at and reset the per-window counter so the
    // next alert reports occurrences since this one.
    const sent = await sendErrorAlert({
      title: `${name}: ${message}`,
      route,
      occurrences,
      firstSeen,
      detail: (err.stack || message).slice(0, 2000),
    });
    if (sent) {
      await admin
        .from("error_alerts")
        .update({ last_emailed_at: nowIso, occurrences: 0 })
        .eq("fingerprint", fingerprint);
    }
  } catch (e) {
    // Throttle/store failed — fail safe (no email) rather than risk a storm.
    console.error("[error-report] throttle/store failed:", e);
  }
}
