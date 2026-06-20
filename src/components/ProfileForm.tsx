"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CoverCropper } from "@/components/CoverCropper";
import type { ProfileFields } from "@/lib/profile";

const BIO_MAX = 280;

// Public profile editor: avatar (square-crop upload to the avatars bucket), bio,
// and social links. Saves directly to the user's own profile row (column grants
// + the "users update own profile" RLS policy permit it).
export function ProfileForm({
  userId,
  displayName,
  initial,
}: {
  userId: string;
  displayName: string | null;
  initial: ProfileFields;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const [fullName, setFullName] = useState(initial.full_name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [website, setWebsite] = useState(initial.website_url ?? "");
  const [x, setX] = useState(initial.x_url ?? "");
  const [github, setGithub] = useState(initial.github_url ?? "");
  const [bluesky, setBluesky] = useState(initial.bluesky_url ?? "");
  const [mastodon, setMastodon] = useState(initial.mastodon_url ?? "");
  const [linkedin, setLinkedin] = useState(initial.linkedin_url ?? "");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (displayName ?? "?").trim().charAt(0).toUpperCase() || "?";

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "webp";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function norm(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
        website_url: norm(website),
        x_url: norm(x),
        github_url: norm(github),
        bluesky_url: norm(bluesky),
        mastodon_url: norm(mastodon),
        linkedin_url: norm(linkedin),
      } as never)
      .eq("id", userId);
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const socials: {
    label: string;
    value: string;
    set: (v: string) => void;
    placeholder: string;
  }[] = [
    { label: "Website", value: website, set: setWebsite, placeholder: "example.com" },
    { label: "X", value: x, set: setX, placeholder: "x.com/username" },
    { label: "GitHub", value: github, set: setGithub, placeholder: "github.com/username" },
    { label: "Bluesky", value: bluesky, set: setBluesky, placeholder: "bsky.app/profile/username" },
    { label: "Mastodon", value: mastodon, set: setMastodon, placeholder: "mastodon.social/@username" },
    { label: "LinkedIn", value: linkedin, set: setLinkedin, placeholder: "linkedin.com/in/username" },
  ];

  const field =
    "mt-1 w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--border-strong)]";

  return (
    <div className="mt-3 space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Your avatar"
            width={56}
            height={56}
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--hover)] text-lg font-medium text-[color:var(--muted)]">
            {initials}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-[color:var(--border-strong)] px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {uploading ? "Uploading…" : avatarUrl ? "Replace" : "Upload avatar"}
        </button>
        {avatarUrl ? (
          <button
            type="button"
            onClick={() => setAvatarUrl("")}
            className="text-sm text-black/60 hover:underline dark:text-white/50"
          >
            Remove
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCropFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Full name */}
      <label className="block text-sm font-medium">
        Full name
        <input
          type="text"
          value={fullName}
          maxLength={80}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Nick Smith"
          className={`${field} font-normal`}
        />
        <span className="mt-1 block text-xs font-normal text-[color:var(--muted)]">
          Shown as your byline and on your author page. Leave blank to use your
          username.
        </span>
      </label>

      {/* Bio */}
      <label className="block text-sm font-medium">
        <span className="flex items-center justify-between">
          Bio
          <span
            className={`text-xs font-normal ${bio.trim().length > BIO_MAX ? "text-[color:var(--danger)]" : "text-[color:var(--muted)]"}`}
          >
            {bio.trim().length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={BIO_MAX}
          placeholder="A sentence or two about you, shown on your author page."
          className={`${field} font-normal`}
        />
      </label>

      {/* Social links */}
      <div className="space-y-3">
        {socials.map((s) => (
          <label key={s.label} className="block text-sm font-medium">
            {s.label}
            <input
              type="text"
              inputMode="url"
              value={s.value}
              onChange={(e) => s.set(e.target.value)}
              placeholder={s.placeholder}
              className={`${field} font-normal`}
            />
          </label>
        ))}
      </div>

      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-[color:var(--success)]">Saved.</p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={saving || uploading}
        className="rounded-md bg-[color:var(--button-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-fg)] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>

      {cropFile ? (
        <CoverCropper
          file={cropFile}
          aspect={1}
          outWidth={400}
          title="Crop avatar (square)"
          fileSuffix="avatar"
          onCancel={() => setCropFile(null)}
          onConfirm={(cropped) => {
            setCropFile(null);
            uploadAvatar(cropped);
          }}
        />
      ) : null}
    </div>
  );
}
