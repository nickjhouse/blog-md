// Server-side Cloudflare Turnstile verification for the form routes
// (newsletter, comments). Auth forms use Supabase's native CAPTCHA instead, so
// they don't call this.
//
// Fail-safe / no-op: if TURNSTILE_SECRET_KEY isn't set, verification is skipped
// (returns true) so local/unconfigured environments keep working. Once the
// secret is set, a missing/invalid token is rejected.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteip?: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → don't block

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteip) body.set("remoteip", remoteip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
