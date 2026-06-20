"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES } from "@/lib/locales";

type Current = {
  site_name: string | null;
  site_description: string | null;
  contact_email: string | null;
  site_locale: string | null;
  home_intro: string | null;
  home_intro_enabled: boolean;
};

type Defaults = {
  name: string;
  description: string;
  contactEmail: string;
  locale: string;
};

const fieldClass =
  "mt-1 w-full rounded-md border border-(--border) bg-(--surface) px-3 py-2 text-sm focus:border-(--border-strong)";

export function IdentitySettingsForm({
  current,
  defaults,
}: {
  current: Current;
  defaults: Defaults;
}) {
  const router = useRouter();
  const [name, setName] = useState(current.site_name ?? "");
  const [description, setDescription] = useState(current.site_description ?? "");
  const [email, setEmail] = useState(current.contact_email ?? "");
  const [locale, setLocale] = useState(current.site_locale ?? "");
  const [homeIntro, setHomeIntro] = useState(current.home_intro ?? "");
  const [homeIntroEnabled, setHomeIntroEnabled] = useState(
    current.home_intro_enabled,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/settings/identity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_name: name,
        site_description: description,
        contact_email: email,
        site_locale: locale,
        home_intro: homeIntro,
        home_intro_enabled: homeIntroEnabled,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Save failed.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <p className="text-sm text-(--muted)">
        These control the site name, tagline, contact address, and language used
        across the nav, page titles, RSS feed, social cards, and emails. Leave a
        field blank to use its built-in default.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Site name</span>
          <input
            type="text"
            value={name}
            maxLength={60}
            placeholder={defaults.name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Description / tagline</span>
          <textarea
            value={description}
            maxLength={200}
            rows={2}
            placeholder={defaults.description}
            onChange={(e) => setDescription(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Contact email</span>
          <input
            type="email"
            value={email}
            maxLength={120}
            placeholder={defaults.contactEmail}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-(--muted)">
            Shown on the privacy policy page.
          </span>
        </label>

        <div className="rounded-md border border-(--border) p-4">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={homeIntroEnabled}
              onChange={(e) => setHomeIntroEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-sm border-(--border-strong)"
            />
            <span className="text-sm font-medium">
              Show homepage intro
              <span className="mt-0.5 block text-xs font-normal text-(--muted)">
                Displays the intro section at the top of the homepage (above
                “Latest posts”).
              </span>
            </span>
          </label>

          {homeIntroEnabled ? (
            <label className="mt-4 block">
              <span className="text-sm font-medium">Homepage intro</span>
              <textarea
                value={homeIntro}
                maxLength={1000}
                rows={5}
                placeholder="A short blurb shown at the top of your homepage — what the site is and what visitors can do here."
                onChange={(e) => setHomeIntro(e.target.value)}
                className={fieldClass}
              />
              <span className="mt-1 block text-xs text-(--muted)">
                Separate paragraphs with a blank line. A privacy-policy line is
                shown beneath it automatically.
              </span>
            </label>
          ) : null}
        </div>

        <label className="block">
          <span className="text-sm font-medium">Language</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className={fieldClass}
          >
            <option value="">Default ({defaults.locale})</option>
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label} ({l.value})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-(--muted)">
            Sets the page language for browsers, screen readers, and the RSS feed.
          </span>
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-(--button-bg) px-3 py-1.5 text-sm font-medium text-(--button-fg) disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {saved ? (
          <span className="text-sm text-(--success)">Saved.</span>
        ) : null}
        {error ? (
          <span className="text-sm text-(--danger)">{error}</span>
        ) : null}
      </div>
    </div>
  );
}
