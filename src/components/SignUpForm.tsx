"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidUsername, USERNAME_HINT } from "@/lib/username";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

type UsernameStatus =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "error";

const inputClass =
  "mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced username availability check.
  useEffect(() => {
    const value = username.trim();
    if (!value) {
      setUsernameStatus("idle");
      return;
    }
    if (!isValidUsername(value)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", value)
        .limit(1);
      if (error) {
        setUsernameStatus("error");
        return;
      }
      setUsernameStatus(data && data.length > 0 ? "taken" : "available");
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUsername(username.trim())) {
      setError("Please choose a valid username.");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is taken.");
      return;
    }
    setLoading(true);
    setError(null);

    const captchaToken = (await turnstileRef.current?.getToken()) ?? null;
    if (TURNSTILE_ENABLED && !captchaToken) {
      setLoading(false);
      setError("Verification failed — please try again.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: { username: username.trim() },
        captchaToken: captchaToken ?? undefined,
      },
    });

    setLoading(false);
    if (error) {
      setError(
        /duplicate|unique|database error/i.test(error.message)
          ? "That username may have just been taken — try another."
          : error.message,
      );
      return;
    }
    setDone(true);
  }

  async function resend() {
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setResent(true);
  }

  if (done) {
    return (
      <div className="mt-6 rounded-md border border-[color:var(--border)] p-4 text-sm">
        <p>
          Check your email and click the confirmation link, then sign in to
          start commenting.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={resent}
          className="mt-3 text-black/60 underline disabled:opacity-50 dark:text-white/60"
        >
          {resent ? "Confirmation email resent" : "Didn’t get it? Resend email"}
        </button>
      </div>
    );
  }

  const usernameNote: Record<UsernameStatus, string> = {
    idle: USERNAME_HINT,
    invalid: USERNAME_HINT,
    checking: "Checking availability…",
    available: "Available ✓",
    taken: "That username is taken.",
    error: "Couldn’t check availability.",
  };
  const usernameNoteColor =
    usernameStatus === "available"
      ? "text-[color:var(--success)]"
      : usernameStatus === "taken" || usernameStatus === "invalid"
        ? "text-[color:var(--danger)]"
        : "text-[color:var(--muted)]";

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Username
        <input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
          placeholder="your-name"
        />
        <span className={`mt-1 block text-xs ${usernameNoteColor}`}>
          {usernameNote[usernameStatus]}
        </span>
      </label>

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
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-[color:var(--muted)]">
          At least 8 characters.
        </span>
      </label>

      <TurnstileWidget ref={turnstileRef} />

      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}

      <button
        type="submit"
        disabled={loading || usernameStatus === "checking"}
        className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50 "
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
