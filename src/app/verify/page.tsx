import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignedInUserId, getMfaStepUpRequired } from "@/lib/auth";
import { MfaChallengeForm } from "@/components/MfaChallengeForm";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Two-factor verification" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);

  const userId = await getSignedInUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(target)}`);

  // Already aal2, or no factor enrolled → nothing to do here.
  if (!(await getMfaStepUpRequired())) redirect(target);

  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Two-factor verification</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Your account is protected with an authenticator app.
      </p>
      <MfaChallengeForm next={target} />
    </section>
  );
}
