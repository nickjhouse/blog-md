import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/ResetRequestForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Reset password</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Enter your email and we’ll send you a link to set a new password.
      </p>
      <ResetRequestForm />
    </section>
  );
}
