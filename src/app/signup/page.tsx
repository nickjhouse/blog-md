import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/SignUpForm";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthDivider } from "@/components/AuthDivider";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Sign up to comment on posts. Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
        .
      </p>
      <SignUpForm />
      <Suspense>
        <AuthDivider />
        <GoogleButton />
      </Suspense>
    </section>
  );
}
