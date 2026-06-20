import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignedInUserId } from "@/lib/auth";
import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";

export const metadata: Metadata = { title: "Set new password" };

export default async function UpdatePasswordPage() {
  // Reachable only with a session (the recovery link establishes one via
  // /auth/confirm). Otherwise send to the reset request page.
  const userId = await getSignedInUserId();
  if (!userId) redirect("/reset");

  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <UpdatePasswordForm />
    </section>
  );
}
