"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactMessage } from "@/lib/contact";

// Admin inbox for contact-form submissions. Expand to read; mark read/unread or
// delete. Mutations hit /api/admin/messages/[id] then refresh the server data.
export function ContactInbox({ messages }: { messages: ContactMessage[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setRead(id: string, read: boolean) {
    setBusyId(id);
    await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    setBusyId(id);
    await fetch(`/api/admin/messages/${id}`, { method: "DELETE" }).catch(
      () => {},
    );
    setBusyId(null);
    if (openId === id) setOpenId(null);
    router.refresh();
  }

  function toggleOpen(m: ContactMessage) {
    const next = openId === m.id ? null : m.id;
    setOpenId(next);
    // Opening an unread message marks it read.
    if (next && !m.read) setRead(m.id, true);
  }

  if (messages.length === 0) {
    return (
      <p className="mt-6 text-sm text-[color:var(--muted)]">No messages yet.</p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-[color:var(--border)] rounded-md border border-[color:var(--border)]">
      {messages.map((m) => {
        const open = openId === m.id;
        return (
          <li key={m.id} className={m.read ? "" : "bg-[color:var(--hover)]"}>
            <button
              type="button"
              onClick={() => toggleOpen(m)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {!m.read ? (
                    <span
                      aria-label="Unread"
                      className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]"
                    />
                  ) : null}
                  <span
                    className={`truncate text-sm ${m.read ? "" : "font-semibold"}`}
                  >
                    {m.subject || "(no subject)"}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-[color:var(--muted)]">
                  {m.name} · {m.email} ·{" "}
                  {new Date(m.createdAt).toLocaleString()}
                  {!m.emailSent ? " · email not sent" : ""}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[color:var(--muted)]">
                {open ? "Hide" : "View"}
              </span>
            </button>

            {open ? (
              <div className="px-4 pb-4">
                <p className="whitespace-pre-wrap rounded-md border border-[color:var(--border)] bg-[var(--surface)] p-3 text-sm">
                  {m.body}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent(
                      `Re: ${m.subject || "your message"}`,
                    )}`}
                    className="rounded-md bg-[color:var(--button-bg)] px-3 py-1.5 font-medium text-[color:var(--button-fg)]"
                  >
                    Reply
                  </a>
                  <button
                    type="button"
                    onClick={() => setRead(m.id, !m.read)}
                    disabled={busyId === m.id}
                    className="rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 hover:bg-[color:var(--hover)] disabled:opacity-50"
                  >
                    Mark {m.read ? "unread" : "read"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={busyId === m.id}
                    className="ml-auto text-[color:var(--danger)] hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
