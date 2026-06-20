"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SITE_NAME, SITE_URL } from "@/lib/site.config";

type Factor = { id: string; created_at: string };
type Enrolling = { factorId: string; qrCode: string; secret: string };

// Manage the account's TOTP (authenticator-app) factor. Lists the verified
// factor with a Remove control, or walks through enrollment (QR + manual secret
// → verify a 6-digit code). One factor is plenty for a solo admin, so we only
// offer enrollment when none is verified.
export function MfaManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track an unverified factor so we can clean it up if enrollment is cancelled.
  const pendingFactorId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const totp = data?.totp?.[0];
    setFactor(totp ? { id: totp.id, created_at: totp.created_at } : null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      // Issuer = what the authenticator app displays (e.g. "domain.com").
      // Set it explicitly so it never falls back to the Supabase Site URL
      // default (which shows "localhost:3000" if that's left unset).
      issuer: new URL(SITE_URL).host,
      friendlyName: `${SITE_NAME} authenticator`,
    });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Couldn’t start enrollment.");
      return;
    }
    pendingFactorId.current = data.id;
    setEnrolling({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setCode("");
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    pendingFactorId.current = null;
    setEnrolling(null);
    setCode("");
    await refresh();
    router.refresh(); // session is now aal2
  }

  async function cancelEnroll() {
    const id = pendingFactorId.current;
    setEnrolling(null);
    setCode("");
    setError(null);
    if (id) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: id }).catch(() => {});
      pendingFactorId.current = null;
    }
  }

  async function remove() {
    if (!factor) return;
    if (
      !window.confirm(
        "Remove two-factor authentication? You’ll sign in with just your password until you set it up again.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
    router.refresh();
  }

  if (loading) {
    return (
      <p className="mt-3 text-xs text-(--muted)">Loading…</p>
    );
  }

  // Enrollment in progress: show QR + secret + code entry.
  if (enrolling) {
    return (
      <form onSubmit={confirmEnroll} className="mt-3 space-y-3">
        <p className="text-xs text-(--muted)">
          Scan this with an authenticator app (or enter the key manually), then
          enter the 6-digit code to finish.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrolling.qrCode}
          alt="Authenticator QR code"
          className="h-40 w-40 rounded-md bg-white p-2"
        />
        <p className="break-all text-xs text-(--muted)">
          Manual key: <span className="font-mono">{enrolling.secret}</span>
        </p>
        <label className="block text-sm">
          6-digit code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
          />
        </label>
        {error ? (
          <p className="text-sm text-(--danger)">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !code}
            className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & enable"}
          </button>
          <button
            type="button"
            onClick={cancelEnroll}
            className="rounded-md px-4 py-2 text-sm font-medium text-(--muted)"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // Verified factor present: show status + remove.
  if (factor) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm text-(--success)">
          Authenticator app enabled ✓
        </p>
        {error ? (
          <p className="text-sm text-(--danger)">{error}</p>
        ) : null}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-md border border-(--danger) px-4 py-2 text-sm font-medium text-(--danger) disabled:opacity-50"
        >
          {busy ? "Removing…" : "Remove"}
        </button>
      </div>
    );
  }

  // No factor: offer enrollment.
  return (
    <div className="mt-3 space-y-2">
      {error ? (
        <p className="text-sm text-(--danger)">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={startEnroll}
        disabled={busy}
        className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50"
      >
        {busy ? "Starting…" : "Set up authenticator app"}
      </button>
    </div>
  );
}
