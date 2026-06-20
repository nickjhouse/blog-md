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

export function AccountForm({
  userId,
  initialUsername,
  initialNotifyOnReply,
}: {
  userId: string;
  initialUsername: string | null;
  initialNotifyOnReply: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyOnReply, setNotifyOnReply] = useState(initialNotifyOnReply);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function toggleNotify(next: boolean) {
    setNotifyOnReply(next);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ notify_on_reply: next } as never)
      .eq("id", userId);
    if (error) {
      setError(error.message);
      setNotifyOnReply(!next); // revert on failure
    }
  }

  useEffect(() => {
    const value = username.trim();
    setSaved(false);
    if (value.toLowerCase() === (initialUsername ?? "").toLowerCase()) {
      setStatus("available");
      return;
    }
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
  }, [username, initialUsername]);

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
    // The @supabase/ssr browser client doesn't forward the Database generic to
    // postgrest-js, so the update payload infers as `never` — cast it.
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: value } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "That username is taken."
          : error.message,
      );
      return;
    }
    setSaved(true);
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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)"
        />
        <span className={`mt-1 block text-xs ${noteColor}`}>{note[status]}</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={notifyOnReply}
          onChange={(e) => toggleNotify(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded-sm border-(--border-strong)"
        />
        <span>
          Email me when someone replies to my comment
          <span className="mt-0.5 block text-xs text-(--muted)">
            We’ll only email you about direct replies. Saved automatically.
          </span>
        </span>
      </label>
      {error ? <p className="text-sm text-(--danger)">{error}</p> : null}
      {saved ? <p className="text-sm text-(--success)">Saved.</p> : null}
      <button
        type="submit"
        disabled={saving || status === "checking"}
        className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50 "
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
