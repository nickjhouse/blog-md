import { createAdminClient } from "@/lib/supabase/admin";

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  read: boolean;
  emailSent: boolean;
  createdAt: string;
};

// Full inbox list (newest first). Service-role read — callers must already have
// verified admin access.
export async function listContactMessages(): Promise<ContactMessage[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contact_messages")
    .select("id, name, email, subject, body, read, email_sent, created_at")
    .order("created_at", { ascending: false });
  return (
    (data ?? []) as {
      id: string;
      name: string;
      email: string;
      subject: string | null;
      body: string;
      read: boolean;
      email_sent: boolean;
      created_at: string;
    }[]
  ).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    body: m.body,
    read: m.read,
    emailSent: m.email_sent,
    createdAt: m.created_at,
  }));
}

// Unread count for the admin nav badge. Fail-safe: 0 on any error (e.g. the
// table not yet migrated), so it never breaks the dashboard.
export async function countUnreadContactMessages(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("read", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}
