import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { sendPostNewsletter } from "@/lib/newsletter";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Bearer-secret check (length-aware constant-ish compare).
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

// Catches posts that went live via a future-dated published_at (nothing fires at
// that moment). Triggered by Supabase pg_cron + pg_net (see README.md).
// Idempotent: sendPostNewsletter claims atomically, so re-runs never double-send.
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.auto_newsletter_on_publish) {
    return NextResponse.json({ ok: true, disabled: true, sent: 0 });
  }

  const admin = createAdminClient();
  const { data: due, error: dueErr } = await admin
    .from("posts")
    .select("id, author_id")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .is("newsletter_sent_at", null)
    .order("published_at", { ascending: true })
    .limit(50);

  // Don't mask a query failure as "sent: 0" — this is a reliability job, so a
  // failed read must surface as an error (logged + non-200) so the run is retried.
  if (dueErr) return serverError(dueErr);

  const posts = due ?? [];

  // Scope: when authors aren't included, only auto-send posts authored by an
  // admin. Resolve the relevant author roles in one query.
  let adminAuthorIds = new Set<string>();
  if (!settings.auto_newsletter_include_authors) {
    const authorIds = [
      ...new Set(posts.map((p) => p.author_id).filter((x): x is string => !!x)),
    ];
    if (authorIds.length) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, role")
        .in("id", authorIds);
      adminAuthorIds = new Set(
        (profs ?? []).filter((p) => p.role === "admin").map((p) => p.id),
      );
    }
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of posts) {
    const allowed =
      settings.auto_newsletter_include_authors ||
      p.author_id === null ||
      adminAuthorIds.has(p.author_id);
    if (!allowed) {
      skipped++;
      continue;
    }
    const r = await sendPostNewsletter(p.id);
    if (r.status === "ok") sent++;
    else if (r.status === "skipped") skipped++;
    else failed++;
  }

  return NextResponse.json({ ok: true, considered: posts.length, sent, skipped, failed });
}
