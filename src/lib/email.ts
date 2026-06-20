function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Fire-and-forget admin notification on a new comment, via the Resend REST API.
// No-op (and never throws) unless RESEND_API_KEY / NOTIFY_FROM / NOTIFY_TO are
// all configured. Failures are swallowed so they can't break commenting.
export async function notifyAdminOfComment(opts: {
  postTitle: string;
  postSlug: string;
  authorName: string;
  body: string;
  pending: boolean;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  const to = process.env.NOTIFY_TO;
  if (!apiKey || !from || !to) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const subject = `${opts.pending ? "[Pending] " : ""}New comment on "${opts.postTitle}"`;
  const html = `
    <p><strong>${escapeHtml(opts.authorName)}</strong> commented on
      <a href="${siteUrl}/post/${opts.postSlug}">${escapeHtml(opts.postTitle)}</a>:</p>
    <blockquote>${escapeHtml(opts.body)}</blockquote>
    ${opts.pending ? `<p><a href="${siteUrl}/admin/community/moderation">Review in moderation →</a></p>` : ""}
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch {
    // ignore — notification must never break commenting
  }
}

// Send a newsletter double opt-in confirmation email. Returns true if the send
// was accepted. No-op (returns false) unless RESEND_API_KEY / NOTIFY_FROM set.
export async function sendNewsletterConfirm(opts: {
  to: string;
  confirmUrl: string;
  siteName: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!apiKey || !from) return false;

  const subject = `Confirm your subscription to ${opts.siteName}`;
  const html = `
    <p>Thanks for subscribing to <strong>${escapeHtml(opts.siteName)}</strong>!</p>
    <p>Please confirm your email address to start receiving new posts:</p>
    <p><a href="${opts.confirmUrl}">Confirm my subscription →</a></p>
    <p style="color:#888;font-size:13px">If you didn’t request this, you can
      safely ignore this email — you won’t be subscribed.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Forward a contact-form submission to the site's contact address. reply_to is
// the sender, so the admin can reply directly from their inbox. Returns true if
// the send was accepted. No-op (returns false) unless RESEND_API_KEY /
// NOTIFY_FROM set, or when `to` is missing.
export async function sendContactMessage(opts: {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  siteName: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!apiKey || !from || !opts.to) return false;

  const subject = `[${opts.siteName}] Contact: ${
    opts.subject?.trim() || `Message from ${opts.fromName}`
  }`;
  const html = `
    <p><strong>${escapeHtml(opts.fromName)}</strong>
      (<a href="mailto:${escapeHtml(opts.fromEmail)}">${escapeHtml(opts.fromEmail)}</a>)
      sent a message via the contact form:</p>
    ${opts.subject?.trim() ? `<p><strong>Subject:</strong> ${escapeHtml(opts.subject)}</p>` : ""}
    <blockquote style="white-space:pre-wrap">${escapeHtml(opts.body)}</blockquote>
    <p style="color:#888;font-size:13px">Reply directly to this email to respond
      to ${escapeHtml(opts.fromName)}.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        reply_to: opts.fromEmail,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Server-error alert to the site owner (NOTIFY_TO). Throttling/dedup is handled
// by the caller (lib/error-report) — this just sends. Returns true if accepted.
// No-op (false) unless RESEND_API_KEY / NOTIFY_FROM / NOTIFY_TO are set.
export async function sendErrorAlert(opts: {
  title: string;
  route: string | null;
  occurrences: number;
  firstSeen: string;
  detail: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  const to = process.env.NOTIFY_TO;
  if (!apiKey || !from || !to) return false;

  const subject = `[error] ${opts.title}`.slice(0, 120);
  const html = `
    <p>A server error was reported${opts.route ? ` on <code>${escapeHtml(opts.route)}</code>` : ""}.</p>
    <p><strong>${escapeHtml(opts.title)}</strong></p>
    <pre style="white-space:pre-wrap;font-size:13px">${escapeHtml(opts.detail)}</pre>
    <p style="color:#888;font-size:13px">${opts.occurrences} occurrence(s) since the last alert ·
      first seen ${escapeHtml(opts.firstSeen)}. Further alerts for this error are
      throttled — check the Cloudflare Worker logs for the full picture.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Notify a commenter that someone replied to them. `to` is the recipient
// (the parent comment's author). No-op unless RESEND_API_KEY / NOTIFY_FROM set.
export async function notifyCommentReply(opts: {
  to: string;
  replierName: string;
  postTitle: string;
  postSlug: string;
  body: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!apiKey || !from) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const subject = `${opts.replierName} replied to your comment`;
  const html = `
    <p><strong>${escapeHtml(opts.replierName)}</strong> replied to your comment on
      <a href="${siteUrl}/post/${opts.postSlug}">${escapeHtml(opts.postTitle)}</a>:</p>
    <blockquote>${escapeHtml(opts.body)}</blockquote>
    <p style="color:#888;font-size:13px">You're receiving this because reply
      notifications are on. Turn them off on your account page.</p>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject, html }),
    });
  } catch {
    // ignore
  }
}
