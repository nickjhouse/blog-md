import { createAdminClient } from "@/lib/supabase/admin";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export type PendingComment = {
  id: string;
  body: string;
  created_at: string;
  authorName: string | null;
  postTitle: string;
  postSlug: string;
};

export type ReportedComment = {
  id: string;
  body: string;
  status: "visible" | "hidden" | "pending";
  authorId: string;
  authorName: string | null;
  postTitle: string;
  postSlug: string;
  reportCount: number;
  reasons: string[];
};

export type BlockedUser = {
  id: string;
  display_name: string | null;
  blocked_at: string | null;
};


const COMMENT_EMBED =
  "id, body, status, author_id, author:profiles(display_name), post:posts(title, slug)";

export async function getPendingComments(): Promise<PendingComment[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("comments")
    .select(`${COMMENT_EMBED}, created_at`)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    authorName: one(r.author)?.display_name ?? null,
    postTitle: one(r.post)?.title ?? "",
    postSlug: one(r.post)?.slug ?? "",
  }));
}

export async function getReportedComments(): Promise<ReportedComment[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("comment_reports")
    .select(`reason, comment:comments(${COMMENT_EMBED})`)
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  const byComment = new Map<string, ReportedComment>();
  for (const r of rows) {
    const c = one(r.comment);
    if (!c) continue;
    const existing = byComment.get(c.id);
    if (existing) {
      existing.reportCount += 1;
      if (r.reason) existing.reasons.push(r.reason);
    } else {
      byComment.set(c.id, {
        id: c.id,
        body: c.body,
        status: c.status,
        authorId: c.author_id,
        authorName: one(c.author)?.display_name ?? null,
        postTitle: one(c.post)?.title ?? "",
        postSlug: one(c.post)?.slug ?? "",
        reportCount: 1,
        reasons: r.reason ? [r.reason] : [],
      });
    }
  }
  return [...byComment.values()];
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, display_name, blocked_at")
    .eq("is_blocked", true)
    .order("blocked_at", { ascending: false });

  return data ?? [];
}

// Count of items needing a moderator's attention — pending comments + comments
// with active reports — for the admin nav badge. Lightweight (no embeds). A
// comment that is both pending AND reported counts in both queues, mirroring the
// two separate panels on the moderation page.
export async function countModerationQueue(): Promise<number> {
  const admin = createAdminClient();
  const [pendingRes, reportRes] = await Promise.all([
    admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Reports are deleted on dismiss, so any remaining row is an open report;
    // distinct comment_ids = number of reported comments still to review.
    admin.from("comment_reports").select("comment_id"),
  ]);
  const pending = pendingRes.count ?? 0;
  const reported = new Set((reportRes.data ?? []).map((r) => r.comment_id)).size;
  return pending + reported;
}
