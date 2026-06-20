"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Same-origin only — never push the browser to an attacker-supplied URL.
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken ?? undefined },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If the account has a verified MFA factor, the session is still aal1 — send
    // them through the TOTP step-up before continuing. Read the level from the
    // verified getClaims() + factors from getUser() (avoids the getSession
    // "insecure user" warning that getAuthenticatorAssuranceLevel emits).
    const { data: claimsData } = await supabase.auth.getClaims();
    const aal = (claimsData?.claims as { aal?: string } | undefined)?.aal;
    if (aal !== "aal2") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const hasFactor = (user?.factors ?? []).some(
        (f) => f.status === "verified",
      );
      if (hasFactor) {
        router.push(`/verify?next=${encodeURIComponent(next)}`);
        router.refresh();
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]";

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
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      <TurnstileWidget ref={turnstileRef} />

      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50 "
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <Link
          href="/reset"
          className="text-sm text-black/60 hover:underline dark:text-white/50"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
