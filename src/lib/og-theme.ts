import { getEffectiveTheme } from "@/lib/theme";
import { getSettingsCached } from "@/lib/settings";

// Palette for generated Open Graph cards. An OG card is a single static image,
// so we always render it in the DARK look regardless of the viewer's theme.
function paletteFromTokens(eff: Record<string, string>) {
  return {
    bg: eff["--background"],
    surface: eff["--surface"],
    fg: eff["--foreground"],
    muted: eff["--muted"],
    accent: eff["--accent"],
    border: eff["--border"],
  };
}

// Default palette = the token registry's DARK defaults (single source of truth;
// no separate hardcoded copy to keep in sync). Also the fail-safe fallback.
export const ogTheme = paletteFromTokens(getEffectiveTheme(undefined, "dark"));

// Theme-aware palette: the admin's DARK overrides merged over the defaults.
// MUST fail safe — a settings read error can never break image generation, so
// any failure falls back to the default palette (the card still renders).
export async function getOgTheme(): Promise<typeof ogTheme> {
  try {
    const settings = await getSettingsCached();
    return paletteFromTokens(getEffectiveTheme(settings.theme_overrides, "dark"));
  } catch {
    return ogTheme;
  }
}

export const OG_FONT_FAMILY = "Source Serif 4";

// Self-hosted serif for card titles. Drop a SemiBold static file at one of
// these paths in /public/fonts/ (Satori accepts ttf/otf/woff — NOT woff2):
const FONT_CANDIDATES = [
  "/fonts/SourceSerif4-SemiBold.ttf",
  "/fonts/SourceSerif4-SemiBold.otf",
  "/fonts/SourceSerif4-SemiBold.woff",
];

// Load the serif used for card titles, so they match the site's editorial type.
// Returns null on ANY failure (no file yet, fetch error, build-time) so the
// caller falls back to the renderer's default font — the card still renders.
export async function loadOgFont(baseUrl: string): Promise<ArrayBuffer | null> {
  for (const path of FONT_CANDIDATES) {
    try {
      const res = await fetch(new URL(path, baseUrl));
      if (res.ok) return await res.arrayBuffer();
    } catch {
      // try the next candidate
    }
  }
  return null;
}
