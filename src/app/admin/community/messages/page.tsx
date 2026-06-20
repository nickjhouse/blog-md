import type { Metadata } from "next";
import { listContactMessages } from "@/lib/contact";
import { ContactInbox } from "@/components/ContactInbox";

export const metadata: Metadata = { title: "Messages · Community" };
export const dynamic = "force-dynamic";

// Hub chrome lives in the community layout; the unread count shows on the tab.
export default async function MessagesTab() {
  const messages = await listContactMessages();
  return <ContactInbox messages={messages} />;
}
