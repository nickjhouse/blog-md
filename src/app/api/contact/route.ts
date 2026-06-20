import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContactMessage } from "@/lib/email";
import { getSiteIdentity } from "@/lib/identity";
import { getSettingsCached } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseJson } from "@/lib/route-guards";

// Public contact form. Stores the message first (so it's never lost to a failed
// send), then best-effort emails the site's contact address with reply-to set
// to the sender. Honeypot + Turnstile mirror the newsletter route.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const o = await parseJson(req);

  // Contact page can be disabled in admin settings.
  if (!(await getSettingsCached()).contact_enabled) {
    return NextResponse.json({ error: "Contact form is unavailable." }, { status: 404 });
  }

  // Honeypot: a hidden field bots fill. Pretend success and drop it.
  if (typeof o.website === "string" && o.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const subjectRaw = typeof o.subject === "string" ? o.subject.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";

  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (subjectRaw.length > 200) {
    return NextResponse.json(
      { error: "Subject is too long." },
      { status: 400 },
    );
  }
  if (!body || body.length > 5000) {
    return NextResponse.json(
      { error: "Please enter a message (up to 5000 characters)." },
      { status: 400 },
    );
  }
  const subject = subjectRaw || null;

  // Bot check (no-op unless TURNSTILE_SECRET_KEY is set).
  const turnstileToken =
    typeof o.turnstileToken === "string" ? o.turnstileToken : null;
  if (!(await verifyTurnstile(turnstileToken))) {
    return NextResponse.json(
      { error: "Verification failed — please try again." },
      { status: 400 },
    );
  }

  // Store first — the message must survive even if the email send fails.
  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("contact_messages")
    .insert({ name, email, subject, body })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[contact] insert failed:", error?.message);
    return NextResponse.json(
      { error: "Couldn’t send your message — please try again later." },
      { status: 500 },
    );
  }

  // Best-effort notification. The message is already saved, so a send failure
  // doesn't fail the request — it's just flagged in the admin inbox.
  const identity = await getSiteIdentity();
  const sent = await sendContactMessage({
    to: identity.contactEmail,
    fromName: name,
    fromEmail: email,
    subject,
    body,
    siteName: identity.name,
  });
  if (sent) {
    await supabase
      .from("contact_messages")
      .update({ email_sent: true })
      .eq("id", inserted.id);
  }

  return NextResponse.json({ ok: true });
}
