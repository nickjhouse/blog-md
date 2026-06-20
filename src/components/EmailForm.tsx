"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Change the account email. Re-authenticates with the current password (like the
// delete flow) so a session-only attacker can't trigger it, then calls
// updateUser({ email }). With Supabase "Secure email change" on, a confirmation
// link is sent to BOTH the old and new address; the change only applies once
// confirmed (handled by /auth/confirm).
export function EmailForm({ initialEmail }: { initialEmail: string | null }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (initialEmail && email === initialEmail.trim().toLowerCase()) {
      setError("That’s already your email address.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const currentEmail = user?.email;
    if (!currentEmail) {
      setLoading(false);
      setError("Your session has expired — please sign in again.");
      return;
    }

    const captchaToken = (await turnstileRef.current?.getToken()) ?? null;
    if (TURNSTILE_ENABLED && !captchaToken) {
      setLoading(false);
      setError("Verification failed — please try again.");
      return;
    }

    // Re-authenticate with the current password.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password,
      options: { captchaToken: captchaToken ?? undefined },
    });
    if (signInError) {
      setLoading(false);
      setError(
        /invalid login credentials/i.test(signInError.message)
          ? "Incorrect password."
          : signInError.message,
      );
      return;
    }

    // Request the change; Supabase emails the confirmation link(s).
    const { error: updateError } = await supabase.auth.updateUser({ email });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNewEmail("");
    setPassword("");
    setSent(true);
  }

  if (sent) {
    return (
      <p className="mt-3 rounded-md border border-[color:var(--border)] p-3 text-sm">
        Almost done — check both your current and new email inboxes for a
        confirmation link. Your email changes once you confirm.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      {initialEmail ? (
        <p className="text-xs text-[color:var(--muted)]">
          Current email: <span className="font-medium">{initialEmail}</span>
        </p>
      ) : null}
      <label className="block text-sm">
        New email
        <input
          type="email"
          required
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
        />
      </label>
      <label className="block text-sm">
        Confirm your password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
        />
      </label>
      <TurnstileWidget ref={turnstileRef} />
      {error ? (
        <p className="text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={loading || !newEmail || !password}
        className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
      >
        {loading ? "Sending…" : "Change email"}
      </button>
    </form>
  );
}
