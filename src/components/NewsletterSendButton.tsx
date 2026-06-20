"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  postId: string;
  initialSentAt: string | null;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function NewsletterSendButton({ postId, initialSentAt }: Props) {
  const router = useRouter();
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const already = !!sentAt;
    const msg = already
      ? "This post’s newsletter was already sent. Send it AGAIN to all subscribers?"
      : "Send this post to all newsletter subscribers now?";
    if (!confirm(msg)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/posts/${postId}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: already }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sentAt?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn’t send.");
        return;
      }
      setSentAt(data.sentAt ?? new Date().toISOString());
      router.refresh();
    } catch {
      setError("Couldn’t send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-(--border) bg-(--surface) p-4">
      <h2 className="text-sm font-medium">Newsletter</h2>
      <p className="mt-1 text-xs text-(--muted)">
        {sentAt
          ? `Sent to subscribers on ${fmt(sentAt)}.`
          : "Not sent yet. This emails the post (title, excerpt, link) to all subscribers."}
      </p>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className={`mt-3 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          sentAt
            ? "border border-(--border-strong) hover:bg-(--hover)"
            : "bg-(--button-bg) text-(--button-fg)"
        }`}
      >
        {busy
          ? "Sending…"
          : sentAt
            ? "Send again"
            : "Send to newsletter"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-(--danger)">{error}</p>
      ) : null}
    </div>
  );
}
