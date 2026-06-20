"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// "Continue with Google" — kicks off Supabase OAuth. On return, /auth/callback
// exchanges the code; new users (no username yet) are routed to /account to
// choose one. No Turnstile here — OAuth doesn't hit the password endpoint.
export function GoogleButton() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next,
        )}`,
      },
    });
    // On success the browser is redirected to Google; only errors return here.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-(--border-strong) px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
          />
        </svg>
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-(--danger)">{error}</p>
      ) : null}
    </div>
  );
}
