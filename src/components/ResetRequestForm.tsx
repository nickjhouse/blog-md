"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const captchaToken = (await turnstileRef.current?.getToken()) ?? null;
    if (TURNSTILE_ENABLED && !captchaToken) {
      setLoading(false);
      setError("Verification failed — please try again.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/update-password`,
      captchaToken: captchaToken ?? undefined,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    // Neutral message — don't reveal whether the email is registered.
    return (
      <p className="mt-6 rounded-md border border-(--border) p-4 text-sm">
        If an account exists for that email, a password reset link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
        />
      </label>
      <TurnstileWidget ref={turnstileRef} />
      {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50 "
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
