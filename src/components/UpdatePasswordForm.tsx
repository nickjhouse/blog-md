"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <p className="mt-6 text-sm text-(--success)">
        Password updated. Redirecting…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
        />
        <span className="mt-1 block text-xs text-(--muted)">
          At least 8 characters.
        </span>
      </label>
      {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50 "
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
