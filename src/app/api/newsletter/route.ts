import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewsletterConfirm } from "@/lib/email";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseJson } from "@/lib/route-guards";

// Double opt-in: a signup stores a confirmation token and emails a confirm
// link. The contact is only added to the Resend Audience after they click it
// (handled by /newsletter/confirm). Reads RESEND_API_KEY + RESEND_AUDIENCE_ID
// at runtime via the email/subscribe helpers.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  const o = await parseJson(req);

  // Honeypot: a hidden field bots fill. Pretend success and drop it.
  if (typeof o.website === "string" && o.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  // Bot check (no-op unless TURNSTILE_SECRET_KEY is set).
  const turnstileToken =
    typeof o.turnstileToken === "string" ? o.turnstileToken : null;
  if (!(await verifyTurnstile(turnstileToken))) {
    return NextResponse.json(
      { error: "Verification failed — please try again." },
      { status: 400 },
    );
  }

  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_FROM) {
    return NextResponse.json(
      { error: "Newsletter isn’t configured yet." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // Clear any prior pending tokens for this email, then store the new one.
  await supabase.from("newsletter_confirmations").delete().eq("email", email);
  const { error } = await supabase
    .from("newsletter_confirmations")
    .insert({ token, email, expires_at: expiresAt });
  if (error) {
    console.error("[newsletter] token insert failed:", error.message);
    return NextResponse.json(
      { error: "Couldn’t start the signup — please try again later." },
      { status: 500 },
    );
  }

  const confirmUrl = `${SITE_URL}/newsletter/confirm?token=${token}`;
  const { name: siteName } = await getSiteIdentity();
  const sent = await sendNewsletterConfirm({
    to: email,
    confirmUrl,
    siteName,
  });
  if (!sent) {
    return NextResponse.json(
      { error: "Couldn’t send the confirmation email — please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
