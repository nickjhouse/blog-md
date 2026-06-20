"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/track";
import { markSubscribed } from "@/lib/newsletter-prompt";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

type State = "idle" | "submitting" | "done" | "error";

// onSubscribed: optional hook fired after a successful subscribe (the capture
// card uses it to dismiss itself). Subscribing anywhere also flags localStorage
// so the capture prompt won't reappear.
export function NewsletterSignup({
  onSubscribed,
}: {
  onSubscribed?: () => void;
} = {}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setMessage(null);
    const captchaToken = (await turnstileRef.current?.getToken()) ?? null;
    if (TURNSTILE_ENABLED && !captchaToken) {
      setState("error");
      setMessage("Verification failed — please try again.");
      return;
    }
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website, turnstileToken: captchaToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        track("newsletter_signup");
        markSubscribed();
        onSubscribed?.();
        setState("done");
        setMessage("Almost there — check your inbox to confirm your subscription.");
        setEmail("");
      } else {
        setState("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <p className="text-sm text-black/70 dark:text-white/70">{message}</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <p className="text-sm font-medium text-black/80 dark:text-white/80">
        Get new posts by email
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="min-w-0 flex-1 rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="shrink-0 rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50 "
        >
          {state === "submitting" ? "…" : "Subscribe"}
        </button>
      </div>
      {/* Honeypot — visually hidden, not for real users. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <TurnstileWidget ref={turnstileRef} />
      {message && state === "error" ? (
        <p className="mt-2 text-sm text-[color:var(--danger)]">{message}</p>
      ) : null}
    </form>
  );
}
