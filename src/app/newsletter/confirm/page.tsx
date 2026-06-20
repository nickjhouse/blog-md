import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscribeToAudience } from "@/lib/newsletter";

export const metadata: Metadata = {
  title: "Confirm subscription",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string }>;
type Status = "confirmed" | "already" | "invalid" | "error";

async function confirm(token: string): Promise<Status> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("newsletter_confirmations")
    .select("email, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return "invalid";

  // Expired → drop it and treat as invalid.
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from("newsletter_confirmations").delete().eq("token", token);
    return "invalid";
  }

  const result = await subscribeToAudience(row.email);
  if (result === "error" || result === "not_configured") return "error";

  // Single-use: consume the token.
  await supabase.from("newsletter_confirmations").delete().eq("token", token);
  return result === "already" ? "already" : "confirmed";
}

const COPY: Record<Status, { title: string; body: string }> = {
  confirmed: {
    title: "You’re subscribed!",
    body: "Thanks for confirming — you’ll get an email when there’s a new post.",
  },
  already: {
    title: "You’re already subscribed",
    body: "This email is already on the list. Nothing more to do!",
  },
  invalid: {
    title: "This link is invalid or expired",
    body: "Confirmation links expire after 24 hours. Please sign up again to get a fresh one.",
  },
  error: {
    title: "Something went wrong",
    body: "We couldn’t confirm your subscription right now. Please try again later.",
  },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;
  const status = token ? await confirm(token) : "invalid";
  const { title, body } = COPY[status];

  return (
    <section className="max-w-lg">
      <h1 className="font-serif text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-[color:var(--muted)]">{body}</p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm text-[color:var(--accent)] hover:underline"
      >
        ← Back to the blog
      </Link>
    </section>
  );
}
