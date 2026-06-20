import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth";
import { UsernameSetupForm } from "@/components/UsernameSetupForm";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Choose a username" };
export const dynamic = "force-dynamic";

// Forced set-username step. New OAuth users land here from /auth/callback before
// they can do anything that needs an identity (commenting). Anyone who already
// has a username is sent straight on.
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);

  const viewer = await getViewerContext();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/welcome?next=${target}`)}`);
  if (viewer.displayName) redirect(target);

  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Choose a username</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Pick a username to finish setting up your account. It’s shown publicly on
        your comments, and you can change it later in your account settings.
      </p>
      <UsernameSetupForm userId={viewer.userId} next={target} />
    </section>
  );
}
