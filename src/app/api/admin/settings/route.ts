import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { updateSettings, type SiteSettings } from "@/lib/settings";
import { revalidateLayout } from "@/lib/revalidate";

// Update site settings (approval toggle, notify toggle) — admin only.
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const patch: Partial<SiteSettings> = {};
  if (typeof o.require_comment_approval === "boolean") {
    patch.require_comment_approval = o.require_comment_approval;
  }
  if (typeof o.notify_on_comment === "boolean") {
    patch.notify_on_comment = o.notify_on_comment;
  }
  if (typeof o.rate_limit_seconds === "number") {
    patch.rate_limit_seconds = Math.max(0, Math.min(3600, Math.round(o.rate_limit_seconds)));
  }
  if (typeof o.max_links_per_comment === "number") {
    patch.max_links_per_comment = Math.max(0, Math.min(50, Math.round(o.max_links_per_comment)));
  }
  if (typeof o.auto_newsletter_on_publish === "boolean") {
    patch.auto_newsletter_on_publish = o.auto_newsletter_on_publish;
  }
  if (typeof o.auto_newsletter_include_authors === "boolean") {
    patch.auto_newsletter_include_authors = o.auto_newsletter_include_authors;
  }
  if (typeof o.bulk_publish_sends_newsletter === "boolean") {
    patch.bulk_publish_sends_newsletter = o.bulk_publish_sends_newsletter;
  }
  if (
    o.newsletter_prompt_trigger === "off" ||
    o.newsletter_prompt_trigger === "scroll" ||
    o.newsletter_prompt_trigger === "time" ||
    o.newsletter_prompt_trigger === "exit"
  ) {
    patch.newsletter_prompt_trigger = o.newsletter_prompt_trigger;
  }
  if (typeof o.newsletter_prompt_scroll_pct === "number") {
    patch.newsletter_prompt_scroll_pct = Math.max(
      1,
      Math.min(100, Math.round(o.newsletter_prompt_scroll_pct)),
    );
  }
  if (typeof o.newsletter_prompt_delay_seconds === "number") {
    patch.newsletter_prompt_delay_seconds = Math.max(
      0,
      Math.min(3600, Math.round(o.newsletter_prompt_delay_seconds)),
    );
  }
  if (typeof o.newsletter_prompt_redisplay_days === "number") {
    patch.newsletter_prompt_redisplay_days = Math.max(
      0,
      Math.min(365, Math.round(o.newsletter_prompt_redisplay_days)),
    );
  }
  if (typeof o.contact_enabled === "boolean") {
    patch.contact_enabled = o.contact_enabled;
  }

  await updateSettings(patch);
  // contact toggle + newsletter-prompt config are baked into cached pages.
  revalidateLayout();
  return NextResponse.json({ ok: true });
}
