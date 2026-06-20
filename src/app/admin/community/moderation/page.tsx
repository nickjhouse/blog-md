import type { Metadata } from "next";
import {
  getPendingComments,
  getReportedComments,
  getBlockedUsers,
} from "@/lib/moderation";
import { ModerationPanels } from "@/components/ModerationPanels";

export const metadata: Metadata = { title: "Moderation · Community" };

// Hub chrome (heading, tabs, back-link, admin gate) lives in the community layout.
export default async function ModerationTab() {
  const [pending, reported, blocked] = await Promise.all([
    getPendingComments(),
    getReportedComments(),
    getBlockedUsers(),
  ]);

  return (
    <ModerationPanels pending={pending} reported={reported} blocked={blocked} />
  );
}
