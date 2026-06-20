"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Step-up challenge: the user is signed in (aal1) and has a verified TOTP factor,
// so we ask for a code and elevate the session to aal2, then continue to `next`.
export function MfaChallengeForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const factorId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      factorId.current = data?.totp?.[0]?.id ?? null;
      if (!factorId.current) {
        // No factor after all — nothing to challenge; move along.
        router.replace(next);
      }
    })();
  }, [next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId.current) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factorId.current,
      code: code.trim(),
    });
    if (error) {
      setLoading(false);
      setError(
        /invalid|incorrect/i.test(error.message)
          ? "That code didn’t match. Try again."
          : error.message,
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut().catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Authentication code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
        />
        <span className="mt-1 block text-xs text-[color:var(--muted)]">
          Enter the 6-digit code from your authenticator app.
        </span>
      </label>
      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading || !code}
          className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-black/60 hover:underline dark:text-white/50"
        >
          Sign out
        </button>
      </div>
    </form>
  );
}
