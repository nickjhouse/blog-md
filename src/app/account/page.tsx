import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth";
import { getProfileFields } from "@/lib/profile";
import { AccountForm } from "@/components/AccountForm";
import { EmailForm } from "@/components/EmailForm";
import { ProfileForm } from "@/components/ProfileForm";
import { MfaManager } from "@/components/MfaManager";
import { AccountDanger } from "@/components/AccountDanger";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login?next=/account");

  // Public profile (bio/avatar/socials) only surfaces on author pages, so only
  // authors/admins get the editor. isAuthor covers both roles.
  const profile = viewer.isAuthor
    ? await getProfileFields(viewer.userId)
    : null;

  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Account</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Your username is shown publicly on your comments.
      </p>

      {!viewer.displayName ? (
        <p className="mt-4 rounded-md border border-[color:var(--border-strong)] bg-[color:var(--accent-soft,transparent)] p-3 text-sm">
          Almost there — choose a username below to finish setting up your
          account and start commenting.
        </p>
      ) : null}

      <AccountForm
        userId={viewer.userId}
        initialUsername={viewer.displayName}
        initialNotifyOnReply={viewer.notifyOnReply}
      />

      <div className="mt-10 border-t border-[color:var(--border)] pt-6">
        <h2 className="text-sm font-semibold">Email</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Used to sign in and for account notifications. Changing it requires
          confirmation from both your current and new address.
        </p>
        <EmailForm initialEmail={viewer.email} />
      </div>

      {viewer.isAuthor && profile ? (
        <div className="mt-10 border-t border-[color:var(--border)] pt-6">
          <h2 className="text-sm font-semibold">Public profile</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Your avatar, bio, and links — shown on your author page (and your
            avatar alongside your posts).
          </p>
          <ProfileForm
            userId={viewer.userId}
            displayName={viewer.displayName}
            initial={profile}
          />
        </div>
      ) : null}

      {viewer.isAdmin ? (
        <div className="mt-10 border-t border-[color:var(--border)] pt-6">
          <h2 className="text-sm font-semibold">Two-factor authentication</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Add a one-time code from an authenticator app to your sign-in. Keep
            your recovery in mind — if you lose the app, the factor must be
            cleared in Supabase to regain access.
          </p>
          <MfaManager />
        </div>
      ) : null}

      <div className="mt-10 border-t border-[color:var(--border)] pt-6">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Download a copy of your account data — profile, comments, reactions,
          and bookmarks — as a JSON file.
        </p>
        {/* API download route, not a page — Link would be inappropriate. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/account/export"
          className="mt-3 inline-block rounded-md border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium"
        >
          Download my data
        </a>
      </div>

      <AccountDanger />
    </section>
  );
}
