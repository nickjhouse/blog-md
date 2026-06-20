"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/lib/settings";

// Auto-newsletter toggles. Posts to the shared /api/admin/settings route.
export function NewsletterSettings({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);

  async function setSetting(patch: Partial<SiteSettings>) {
    setS((prev) => ({ ...prev, ...patch }));
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <p className="text-sm text-[color:var(--muted)]">
        When on, publishing a post emails it to your newsletter audience
        automatically (the same broadcast as the manual “Send to newsletter”
        button, which stays available either way).
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s.auto_newsletter_on_publish}
          onChange={(e) =>
            setSetting({ auto_newsletter_on_publish: e.target.checked })
          }
        />
        Automatically send the newsletter when a post is published
      </label>
      {s.auto_newsletter_on_publish ? (
        <>
          <label className="ml-6 mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.auto_newsletter_include_authors}
              onChange={(e) =>
                setSetting({ auto_newsletter_include_authors: e.target.checked })
              }
            />
            Include posts published by authors, not just admins
          </label>
          <label className="ml-6 mt-2 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.bulk_publish_sends_newsletter}
              onChange={(e) =>
                setSetting({
                  bulk_publish_sends_newsletter: e.target.checked,
                })
              }
              className="mt-0.5"
            />
            <span>
              Also send when publishing two or more posts at once
              <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                Off by default. Publishing a single post (in the editor or from
                the list) always follows the setting above; this only controls
                multi-post bulk publishes, which could otherwise send one email
                per post.
              </span>
            </span>
          </label>
        </>
      ) : null}

      <hr className="my-6 border-[color:var(--border)]" />

      <h2 className="font-serif text-lg font-bold">Capture prompt</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        A non-modal card that slides into the bottom corner inviting readers to
        subscribe. It hides itself once a visitor subscribes (here or in the
        footer) and respects a dismissal.
      </p>

      <label className="mt-4 block max-w-xs text-sm font-medium">
        Show the prompt
        <select
          value={s.newsletter_prompt_trigger}
          onChange={(e) =>
            setSetting({
              newsletter_prompt_trigger: e.target
                .value as SiteSettings["newsletter_prompt_trigger"],
            })
          }
          className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
        >
          <option value="off">Off — never show</option>
          <option value="scroll">After scrolling down the page</option>
          <option value="time">After a few seconds on the page</option>
          <option value="exit">On exit intent (leaving / fast scroll up)</option>
        </select>
      </label>

      {s.newsletter_prompt_trigger === "scroll" ? (
        <label className="mt-3 block max-w-xs text-sm font-medium">
          Scroll depth before showing (%)
          <input
            type="number"
            min={1}
            max={100}
            value={s.newsletter_prompt_scroll_pct}
            onChange={(e) =>
              setSetting({
                newsletter_prompt_scroll_pct: Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
          />
        </label>
      ) : null}

      {s.newsletter_prompt_trigger === "time" ? (
        <label className="mt-3 block max-w-xs text-sm font-medium">
          Seconds on page before showing
          <input
            type="number"
            min={0}
            max={3600}
            value={s.newsletter_prompt_delay_seconds}
            onChange={(e) =>
              setSetting({
                newsletter_prompt_delay_seconds: Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
          />
        </label>
      ) : null}

      {s.newsletter_prompt_trigger !== "off" ? (
        <label className="mt-3 block max-w-xs text-sm font-medium">
          Re-show days after dismissal
          <input
            type="number"
            min={0}
            max={365}
            value={s.newsletter_prompt_redisplay_days}
            onChange={(e) =>
              setSetting({
                newsletter_prompt_redisplay_days: Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]"
          />
          <span className="mt-1 block text-xs font-normal text-[color:var(--muted)]">
            How long after someone closes the card before it may appear again.
            Set to 0 to never re-show after a dismissal.
          </span>
        </label>
      ) : null}
    </div>
  );
}
