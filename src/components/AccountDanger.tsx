"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

// Danger zone: permanently delete the signed-in user's account. Requires the
// current password (verified server-side) and runs Turnstile if configured.
export function AccountDanger() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Re-authenticate with the password before doing anything irreversible.
    // Done client-side (like the login form) so the Turnstile token is redeemed
    // in the browser, where Supabase's CAPTCHA check validates reliably.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email) {
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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
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

    // Password verified — delete the account (the route trusts the session).
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        // Account is gone — clear the local session and leave.
        await supabase.auth.signOut().catch(() => {});
        router.push("/");
        router.refresh();
        return;
      }
      setLoading(false);
      setError(data.error ?? "Couldn’t delete your account.");
    } catch {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mt-10 rounded-md border border-[color:var(--danger)]/40 p-4">
      <h2 className="text-sm font-semibold text-[color:var(--danger)]">
        Delete account
      </h2>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Permanently deletes your account, profile, comments, reactions, and
        bookmarks. Posts you authored are kept but lose their byline. This can’t
        be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-md border border-[color:var(--danger)] px-4 py-2 text-sm font-medium text-[color:var(--danger)]"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={onDelete} className="mt-3 space-y-3">
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !password}
              className="rounded-md bg-[color:var(--danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError(null);
              }}
              className="rounded-md px-4 py-2 text-sm font-medium text-[color:var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
