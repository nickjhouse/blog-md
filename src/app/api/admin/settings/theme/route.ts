import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { getSettings, updateSettings, type ThemeOverrides } from "@/lib/settings";
import { isThemeTokenName, MODES } from "@/lib/theme";
import { isHexColor } from "@/lib/color";
import { revalidateLayout } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

// Keep only known token names mapped to valid hex colors — drop everything else
// (unknown keys, non-hex values). Strict allowlist prevents CSS injection
// through a variable value. Returns undefined if the mode has no valid entries.
function cleanMode(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string" && isThemeTokenName(k) && isHexColor(v)) {
      out[k] = v.toLowerCase();
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// Update the theme color overrides. Admin-only. Body: { light?, dark? } maps of
// CSS variable → hex. Anything invalid is dropped (not an error).
// `asDefault: true` also snapshots this theme as the saved default (the target
// of "Reset to default"), in addition to applying it live.
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const overrides: ThemeOverrides = {};
  for (const mode of MODES) {
    const cleaned = cleanMode(o[mode]);
    if (cleaned) overrides[mode] = cleaned;
  }

  await updateSettings(
    o.asDefault === true
      ? { theme_overrides: overrides, theme_default: overrides }
      : { theme_overrides: overrides },
  );
  // Theme CSS vars are inlined into the layout of every cached page.
  revalidateLayout();
  return NextResponse.json({ ok: true });
}

// Reset the LIVE theme to the saved default snapshot (theme_default). Admin-only.
// If no default was ever saved, theme_default is {} so this matches DELETE.
export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const settings = await getSettings();
  await updateSettings({ theme_overrides: settings.theme_default });
  revalidateLayout();
  return NextResponse.json({ ok: true });
}

// Reset all theme overrides to the built-in globals.css defaults. Admin-only.
// Leaves the saved default (theme_default) untouched.
export async function DELETE() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  await updateSettings({ theme_overrides: {} });
  // Resetting colors also changes the layout on every cached page.
  revalidateLayout();
  return NextResponse.json({ ok: true });
}
