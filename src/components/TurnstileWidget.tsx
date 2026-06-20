"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile widget, INVISIBLE / execute-on-submit. Renders nothing
// visible; the challenge runs only when a form calls `getToken()` on submit, and
// a visible challenge appears only if Cloudflare requires human interaction
// (`appearance: "interaction-only"`). Inert until the site key is configured.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// True at build time when the site key is set — forms use this to decide whether
// a null token (no challenge solved) should be treated as a failure.
export const TURNSTILE_ENABLED = !!SITE_KEY;

export type TurnstileHandle = {
  // Runs the challenge and resolves with a one-time token (or null on
  // failure/timeout, or when Turnstile isn't configured).
  getToken: () => Promise<string | null>;
};

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile load failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export const TurnstileWidget = forwardRef<TurnstileHandle>(
  function TurnstileWidget(_props, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const rendered = useRef<Promise<void> | null>(null);
    // Set per getToken() call; the widget callbacks resolve it.
    const resolver = useRef<((token: string | null) => void) | null>(null);

    useEffect(() => {
      if (!SITE_KEY || !container.current) return;
      let cancelled = false;
      rendered.current = loadTurnstile()
        .then(() => {
          if (cancelled || !window.turnstile || !container.current) return;
          widgetId.current = window.turnstile.render(container.current, {
            sitekey: SITE_KEY,
            execution: "execute",
            appearance: "interaction-only",
            callback: (token: string) => resolver.current?.(token),
            "error-callback": () => resolver.current?.(null),
            "expired-callback": () => resolver.current?.(null),
            "timeout-callback": () => resolver.current?.(null),
          });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetId.current);
          } catch {
            // ignore
          }
          widgetId.current = null;
        }
      };
    }, []);

    useImperativeHandle(
      ref,
      (): TurnstileHandle => ({
        async getToken() {
          if (!SITE_KEY) return null;
          try {
            await rendered.current;
          } catch {
            return null;
          }
          if (!window.turnstile || widgetId.current == null) return null;

          return new Promise<string | null>((resolve) => {
            let done = false;
            const finish = (token: string | null) => {
              if (done) return;
              done = true;
              clearTimeout(timer);
              resolver.current = null;
              resolve(token);
            };
            const timer = setTimeout(() => finish(null), 20000);
            resolver.current = finish;
            try {
              window.turnstile!.reset(widgetId.current!);
              window.turnstile!.execute(widgetId.current!);
            } catch {
              finish(null);
            }
          });
        },
      }),
      [],
    );

    if (!SITE_KEY) return null;
    // Empty (zero footprint) until a challenge is actually required, at which
    // point Cloudflare renders the challenge here — so it must NOT be hidden.
    return <div ref={container} />;
  },
);
