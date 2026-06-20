"use client";

import { useRef, useState } from "react";
import {
  TurnstileWidget,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "@/components/TurnstileWidget";

type State = "idle" | "submitting" | "done" | "error";

const field =
  "mt-1 w-full rounded-md border border-(--border) bg-transparent px-3 py-2 text-sm outline-hidden focus:border-(--border-strong)";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
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
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          body,
          website,
          turnstileToken: captchaToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setState("done");
        setMessage("Thanks — your message has been sent.");
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
      <p className="rounded-md border border-(--border) bg-(--hover) px-4 py-3 text-sm">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Name
        <input
          type="text"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={field}
        />
      </label>
      <label className="block text-sm font-medium">
        Subject <span className="font-normal text-(--muted)">(optional)</span>
        <input
          type="text"
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={field}
        />
      </label>
      <label className="block text-sm font-medium">
        <span className="flex items-center justify-between">
          Message
          <span
            className={`text-xs font-normal ${body.length > 5000 ? "text-(--danger)" : "text-(--muted)"}`}
          >
            {body.length}/5000
          </span>
        </span>
        <textarea
          required
          rows={6}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${field} font-normal`}
        />
      </label>

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
        <p className="text-sm text-(--danger)">{message}</p>
      ) : null}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="rounded-md bg-(--button-bg) px-4 py-2 text-sm font-medium text-(--button-fg) disabled:opacity-50"
      >
        {state === "submitting" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
