"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidUsername, USERNAME_HINT } from "@/lib/username";

type Status =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "error";

// Forced onboarding step: a signed-in user with no username picks one here, then
// continues to `next`. Used by /welcome (e.g. right after Google sign-in).
export function UsernameSetupForm({
  userId,
  next,
}: {
  userId: string;
  next: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const value = username.trim();
    if (!value) {
      setStatus("idle");
      return;
    }
    if (!isValidUsername(value)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", value)
        .limit(1);
      if (error) {
        setStatus("error");
        return;
      }
      setStatus(data && data.length > 0 ? "taken" : "available");
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = username.trim();
    if (!isValidUsername(value)) {
      setError("Please choose a valid username.");
      return;
    }
    if (status === "taken") {
      setError("That username is taken.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: value } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setError(
        error.code === "23505" ? "That username is taken." : error.message,
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const note: Record<Status, string> = {
    idle: USERNAME_HINT,
    invalid: USERNAME_HINT,
    checking: "Checking availability…",
    available: "Available ✓",
    taken: "That username is taken.",
    error: "Couldn’t check availability.",
  };
  const noteColor =
    status === "available"
      ? "text-(--success)"
      : status === "taken" || status === "invalid"
        ? "text-(--danger)"
        : "text-(--muted)";

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Username
        <input
          required
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
        />
        <span className={`mt-1 block text-xs ${noteColor}`}>{note[status]}</span>
      </label>
      {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
      <button
        type="submit"
        disabled={saving || status === "checking" || status === "taken"}
        className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50"
      >
        {saving ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
