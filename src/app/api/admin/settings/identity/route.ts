import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { updateSettings, type SiteSettings } from "@/lib/settings";
import { isValidLocale } from "@/lib/locales";
import { revalidateLayout } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trim a string field; empty ⇒ null (revert to the code default). Non-strings
// ⇒ undefined (field absent / wrong type → leave unchanged).
function cleanText(v: unknown, max: number): string | null | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t === "") return null;
  return t.slice(0, max);
}

// Update the site identity (name / description / contact email / locale).
// Admin-only. Empty values revert that field to its site.config.ts default.
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const patch: Partial<SiteSettings> = {};

  const name = cleanText(o.site_name, 60);
  if (name !== undefined) patch.site_name = name;

  const description = cleanText(o.site_description, 200);
  if (description !== undefined) patch.site_description = description;

  const email = cleanText(o.contact_email, 120);
  if (email !== undefined) {
    if (email !== null && !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    patch.contact_email = email;
  }

  const homeIntro = cleanText(o.home_intro, 1000);
  if (homeIntro !== undefined) patch.home_intro = homeIntro;

  if (typeof o.home_intro_enabled === "boolean") {
    patch.home_intro_enabled = o.home_intro_enabled;
  }

  if (typeof o.site_locale === "string") {
    const locale = o.site_locale.trim();
    if (locale === "") {
      patch.site_locale = null;
    } else if (!isValidLocale(locale)) {
      return NextResponse.json({ error: "Unsupported locale." }, { status: 400 });
    } else {
      patch.site_locale = locale;
    }
  }

  await updateSettings(patch);
  // Site name / description / intro / locale appear on cached pages.
  revalidateLayout();
  return NextResponse.json({ ok: true });
}
