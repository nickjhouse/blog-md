import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteIdentity } from "@/lib/identity";
import { getSettingsCached } from "@/lib/settings";
import { ContactForm } from "@/components/ContactForm";

// Reads the contact_enabled toggle live — must stay dynamic (not cached static).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteIdentity();
  const { contact_enabled } = await getSettingsCached();
  return {
    title: "Contact",
    description: `Get in touch with ${name}.`,
    alternates: { canonical: "/contact" },
    robots: contact_enabled ? undefined : { index: false, follow: false },
  };
}

export default async function ContactPage() {
  const { contact_enabled } = await getSettingsCached();
  if (!contact_enabled) notFound();
  const { name: siteName } = await getSiteIdentity();
  return (
    <section className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Contact</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Have a question or want to get in touch with {siteName}? Send a message
        and we&apos;ll get back to you.
      </p>
      <div className="mt-6">
        <ContactForm />
      </div>
    </section>
  );
}
