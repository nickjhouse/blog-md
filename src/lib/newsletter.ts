import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteIdentity } from "@/lib/identity";
import { SITE_URL } from "@/lib/site.config";
import { deriveExcerpt } from "@/lib/content";
import type { SiteSettings } from "@/lib/settings";
import { autoSendEligible } from "@/lib/newsletter-rules";
import { isLive } from "@/lib/published";

const RESEND_HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

export type BroadcastResult = "ok" | "not_configured" | "error";

// Create + send a Resend Broadcast to the whole audience. Two-step (create,
// then send) for compatibility. The html must include {{{RESEND_UNSUBSCRIBE_URL}}}
// (Resend requires an unsubscribe link in broadcasts).
export async function sendPostBroadcast(opts: {
  subject: string;
  html: string;
}): Promise<BroadcastResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const from = process.env.NOTIFY_FROM;
  if (!apiKey || !audienceId || !from) return "not_configured";

  try {
    const createRes = await fetch("https://api.resend.com/broadcasts", {
      method: "POST",
      headers: RESEND_HEADERS(apiKey),
      body: JSON.stringify({
        audience_id: audienceId,
        from,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!createRes.ok) {
      const d = (await createRes.json().catch(() => ({}))) as {
        message?: string;
      };
      console.error(`[newsletter] broadcast create ${createRes.status}: ${d.message ?? ""}`);
      return "error";
    }
    const created = (await createRes.json()) as { id?: string };
    if (!created.id) return "error";

    const sendRes = await fetch(
      `https://api.resend.com/broadcasts/${created.id}/send`,
      { method: "POST", headers: RESEND_HEADERS(apiKey), body: JSON.stringify({}) },
    );
    if (!sendRes.ok) {
      const d = (await sendRes.json().catch(() => ({}))) as { message?: string };
      console.error(`[newsletter] broadcast send ${sendRes.status}: ${d.message ?? ""}`);
      return "error";
    }
    return "ok";
  } catch (e) {
    console.error("[newsletter] broadcast threw:", e);
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Shared "send a post's newsletter" used by the one-click route, the auto-send
// publish hook, and the cron endpoint. Composes the email, sends the broadcast,
// and stamps posts.newsletter_sent_at — with an ATOMIC CLAIM so concurrent
// callers (e.g. inline publish + cron) can't double-send, and a rollback so a
// failed send can be retried.
// ---------------------------------------------------------------------------

export type SendPostNewsletterResult =
  | { status: "ok"; sentAt: string }
  | { status: "skipped"; reason: "not_found" | "not_live" | "already_sent" }
  | { status: "not_configured" }
  | { status: "error" };

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendPostNewsletter(
  postId: string,
  opts: { force?: boolean } = {},
): Promise<SendPostNewsletterResult> {
  const admin = createAdminClient();

  const { data: post } = await admin
    .from("posts")
    .select(
      "id, title, slug, excerpt, body_md, status, published_at, newsletter_sent_at",
    )
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { status: "skipped", reason: "not_found" };

  if (!isLive(post)) return { status: "skipped", reason: "not_live" };

  const prevSentAt = post.newsletter_sent_at;
  const sentAt = new Date().toISOString();

  // Claim the send. Non-force uses a conditional update (WHERE sent_at IS NULL)
  // so only one caller wins; force overrides an existing stamp ("send again").
  if (opts.force) {
    await admin
      .from("posts")
      .update({ newsletter_sent_at: sentAt })
      .eq("id", postId);
  } else {
    const { data: claimed } = await admin
      .from("posts")
      .update({ newsletter_sent_at: sentAt })
      .eq("id", postId)
      .is("newsletter_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      return { status: "skipped", reason: "already_sent" };
    }
  }

  const { name: siteName } = await getSiteIdentity();
  const url = `${SITE_URL}/post/${post.slug}`;
  const excerpt = post.excerpt?.trim() || deriveExcerpt(post.body_md);
  const html = `
    <h1>${escHtml(post.title)}</h1>
    <p>${escHtml(excerpt)}</p>
    <p><a href="${url}">Read the full post →</a></p>
    <hr />
    <p style="color:#888;font-size:13px">You're receiving this because you
      subscribed to ${escHtml(siteName)}.
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>.</p>
  `;

  const result = await sendPostBroadcast({ subject: post.title, html });
  if (result !== "ok") {
    // Roll the stamp back to its prior value so the post can be retried.
    await admin
      .from("posts")
      .update({ newsletter_sent_at: prevSentAt })
      .eq("id", postId);
    return result === "not_configured"
      ? { status: "not_configured" }
      : { status: "error" };
  }
  return { status: "ok", sentAt };
}

export type AutoNewsletterOutcome = "off" | "sent" | "failed" | "skipped";

// Decide + run the auto-send when a post goes live. Returns "off" if the toggle
// is disabled, the publish isn't a transition-to-live, or the actor isn't
// permitted (authors require the include-authors toggle). Never throws — a
// newsletter failure must not fail the publish.
export async function maybeAutoSendNewsletter(opts: {
  postId: string;
  liveTransition: boolean;
  isAdmin: boolean;
  settings: SiteSettings;
}): Promise<AutoNewsletterOutcome> {
  const { postId, liveTransition, isAdmin, settings } = opts;
  const eligible = autoSendEligible({
    enabled: settings.auto_newsletter_on_publish,
    includeAuthors: settings.auto_newsletter_include_authors,
    liveTransition,
    isAdmin,
  });
  if (!eligible) return "off";
  try {
    const r = await sendPostNewsletter(postId);
    if (r.status === "ok") return "sent";
    if (r.status === "skipped") return "skipped";
    return "failed";
  } catch {
    return "failed";
  }
}

// Adds a confirmed subscriber to the Resend Audience. Shared by the confirm
// route. Reads RESEND_API_KEY + RESEND_AUDIENCE_ID at runtime.
export type SubscribeResult =
  | "ok"
  | "already"
  | "not_configured"
  | "error";

export async function subscribeToAudience(
  email: string,
): Promise<SubscribeResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return "not_configured";

  try {
    const res = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      },
    );
    if (res.ok) return "ok";
    const detail = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = (detail.message ?? "").toLowerCase();
    if (msg.includes("already") || res.status === 409) return "already";
    console.error(`[newsletter] subscribe ${res.status}: ${detail.message ?? ""}`);
    return "error";
  } catch (e) {
    console.error("[newsletter] subscribe threw:", e);
    return "error";
  }
}

export type RemoveResult = "ok" | "not_found" | "not_configured" | "error";

// Fully delete a contact when a user deletes their account (GDPR erasure).
//
// IMPORTANT: we use Resend's account-level Contacts API (/contacts), NOT the
// deprecated audience-scoped one (/audiences/{id}/contacts/{id}). Audiences now
// behave like segments — deleting there only detaches the contact from that
// audience while the real account-level contact (and its subscription) survives.
// Listing/deleting at /contacts removes the contact for good.
//
// We list and delete by the contact's UUID id (addressing by email puts it in the
// URL path, which Resend doesn't reliably match once encoded). No-op unless
// configured; a missing contact is success (nothing to purge).
export async function removeFromAudience(email: string): Promise<RemoveResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "not_configured";

  const target = email.trim().toLowerCase();
  try {
    // no-store is critical: Next.js caches fetch() GETs, and a stale snapshot
    // would return a deleted/old contact id (we'd "delete" a phantom and leave
    // the real, current contact subscribed).
    const listRes = await fetch("https://api.resend.com/contacts", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!listRes.ok) {
      const d = (await listRes.json().catch(() => ({}))) as { message?: string };
      console.error(`[newsletter] remove list ${listRes.status}: ${d.message ?? ""}`);
      return "error";
    }
    const body = (await listRes.json().catch(() => ({}))) as {
      data?: { id: string; email: string }[];
    };
    const contact = (body.data ?? []).find(
      (c) => c.email?.trim().toLowerCase() === target,
    );
    if (!contact) {
      console.log(`[newsletter] remove: no contact for ${target}`);
      return "not_found";
    }

    const delRes = await fetch(
      `https://api.resend.com/contacts/${contact.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const delBody = (await delRes.json().catch(() => ({}))) as {
      deleted?: boolean;
      message?: string;
    };
    if (delRes.ok && delBody.deleted === true) {
      console.log(`[newsletter] removed ${target} (id=${contact.id})`);
      return "ok";
    }
    // 2xx but deleted !== true, or an error status — surface what Resend said.
    console.error(
      `[newsletter] remove delete ${delRes.status} deleted=${delBody.deleted} ` +
        `(id=${contact.id}): ${delBody.message ?? ""}`,
    );
    return "error";
  } catch (e) {
    console.error("[newsletter] remove threw:", e);
    return "error";
  }
}
