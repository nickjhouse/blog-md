import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthDivider } from "@/components/AuthDivider";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <section className="max-w-sm">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        New here?{" "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>{" "}
        to comment.
      </p>
      <Suspense>
        <LoginForm />
        <AuthDivider />
        <GoogleButton />
      </Suspense>
    </section>
  );
}
