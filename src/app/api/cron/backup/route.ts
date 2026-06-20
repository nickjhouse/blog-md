import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Bearer-secret check (length-aware constant-ish compare) — same as the
// newsletter cron.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Scheduled off-platform DB backup → R2. Triggered by Supabase pg_cron + pg_net
// (see README.md), same pattern as the newsletter cron. No-ops with 503 until
// the BACKUP_R2_BUCKET binding is configured.
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // BACKUP_R2_BUCKET is typed via the CloudflareEnv augmentation in
  // cloudflare-env.d.ts, so no cast is needed.
  const bucket = getCloudflareContext().env.BACKUP_R2_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: "Backup bucket not configured." },
      { status: 503 },
    );
  }

  const result = await runBackup(bucket);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
