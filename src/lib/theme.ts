import type { ThemeOverrides } from "@/lib/settings";
import { isHexColor, adjustLightness, mix } from "@/lib/color";

// ============================================================================
// Theme token registry — the single source of truth for the theme editor and
// the override resolver. Defaults MIRROR src/app/globals.css (:root / .dark) —
// keep them in sync if those change (same pattern as lib/og-theme.ts).
//
// This module is dependency-free + server-free so the client ThemeEditor can
// import it (registry, derivation, contrast pairs) without pulling DB code into
// the browser bundle. (`import type` for ThemeOverrides is erased at compile.)
// ============================================================================

export type ThemeMode = "light" | "dark";
export const MODES: ThemeMode[] = ["light", "dark"];

export type TokenGroup = "core" | "interaction" | "status";

export type ThemeToken = {
  name: string; // CSS variable, e.g. "--accent"
  label: string;
  group: TokenGroup;
  light: string; // default (mirrors globals.css :root)
  dark: string; // default (mirrors globals.css .dark)
};

// Editable tokens — exactly what the theme editor exposes.
export const THEME_TOKENS: ThemeToken[] = [
  { name: "--background", label: "Page background", group: "core", light: "#ffffff", dark: "#0a0a0a" },
  { name: "--surface", label: "Surface / cards", group: "core", light: "#ffffff", dark: "#171717" },
  { name: "--foreground", label: "Text", group: "core", light: "#171717", dark: "#ededed" },
  { name: "--muted", label: "Muted text", group: "core", light: "#6b7280", dark: "#a3a3a3" },
  { name: "--border", label: "Border", group: "core", light: "#e5e5e5", dark: "#2a2a2a" },
  { name: "--accent", label: "Accent", group: "core", light: "#171717", dark: "#ededed" },
  { name: "--button-bg", label: "Button background", group: "core", light: "#171717", dark: "#ededed" },
  { name: "--button-fg", label: "Button text", group: "core", light: "#ffffff", dark: "#0a0a0a" },
  { name: "--accent-hover", label: "Accent (hover)", group: "interaction", light: "#000000", dark: "#ffffff" },
  { name: "--border-strong", label: "Border (strong)", group: "interaction", light: "#d4d4d4", dark: "#404040" },
  { name: "--hover", label: "Hover background", group: "interaction", light: "#f5f5f5", dark: "#1a1a1a" },
  { name: "--danger", label: "Danger / error", group: "status", light: "#dc2626", dark: "#f87171" },
  { name: "--success", label: "Success", group: "status", light: "#16a34a", dark: "#4ade80" },
];

export const CORE_TOKENS = THEME_TOKENS.filter((t) => t.group === "core");

const TOKEN_NAMES = new Set(THEME_TOKENS.map((t) => t.name));
export function isThemeTokenName(name: string): boolean {
  return TOKEN_NAMES.has(name);
}

// Default value of a token in a given mode (from the registry above).
export function defaultValue(name: string, mode: ThemeMode): string {
  const t = THEME_TOKENS.find((x) => x.name === name);
  return t ? t[mode] : "";
}

// Which core token(s) each interaction shade is derived from. A shade is only
// re-derived when one of its sources is explicitly overridden — otherwise it
// keeps its registry default, so "no overrides" stays byte-identical to today.
const INTERACTION_SOURCES: Record<string, string[]> = {
  "--accent-hover": ["--accent"],
  "--border-strong": ["--border"],
  "--hover": ["--background", "--foreground"],
};

// Interaction shades are derived from their source core token, so they stay
// cohesive after a core change. Light mode darkens, dark mode lightens —
// matching the default relationships in globals.css.
function deriveShade(
  name: string,
  effective: Record<string, string>,
  mode: ThemeMode,
): string {
  const step = mode === "light" ? -8 : 8;
  if (name === "--accent-hover") return adjustLightness(effective["--accent"], step);
  if (name === "--border-strong") return adjustLightness(effective["--border"], step);
  if (name === "--hover") return mix(effective["--background"], effective["--foreground"], 0.07);
  return effective[name];
}

// Full effective token map for a mode: defaults ← explicit overrides ← derived
// interaction shades.
export function getEffectiveTheme(
  overrides: ThemeOverrides | undefined,
  mode: ThemeMode,
): Record<string, string> {
  const ov = overrides?.[mode] ?? {};
  const eff: Record<string, string> = {};
  for (const t of THEME_TOKENS) eff[t.name] = t[mode];

  for (const [k, v] of Object.entries(ov)) {
    if (isThemeTokenName(k) && isHexColor(v)) eff[k] = v;
  }

  for (const t of THEME_TOKENS) {
    if (t.group !== "interaction") continue;
    const explicit = ov[t.name];
    if (explicit && isHexColor(explicit)) continue; // explicit override wins
    // Only re-derive if a source's EFFECTIVE value differs from its default;
    // otherwise keep the registry default so "no real change" emits nothing
    // (even if a token was explicitly set back to its own default value).
    const sources = INTERACTION_SOURCES[t.name] ?? [];
    const sourceChanged = sources.some(
      (s) => eff[s].toLowerCase() !== defaultValue(s, mode).toLowerCase(),
    );
    if (sourceChanged) eff[t.name] = deriveShade(t.name, eff, mode);
  }

  return eff;
}

// Build the override CSS injected into the layout <head>. Emits only tokens that
// DIFFER from their globals.css default (so unset = no output = today's theme).
//
// Selectors are doubled (`:root:root` / `:root.dark`) to raise specificity above
// the base `:root` / `.dark` rules in globals.css — this guarantees the override
// wins regardless of stylesheet source order, without resorting to !important.
export function resolveThemeStyles(overrides: ThemeOverrides | undefined): string {
  const blocks: string[] = [];

  for (const mode of MODES) {
    const eff = getEffectiveTheme(overrides, mode);
    const decls: string[] = [];
    for (const [name, value] of Object.entries(eff)) {
      if (value.toLowerCase() !== defaultValue(name, mode).toLowerCase()) {
        decls.push(`${name}:${value}`);
      }
    }
    if (decls.length === 0) continue;
    const selector = mode === "light" ? ":root:root" : ":root.dark";
    blocks.push(`${selector}{${decls.join(";")}}`);
  }

  return blocks.join("");
}

// Pairs to surface in the contrast checker (token A vs token B), per mode.
export const CONTRAST_PAIRS: { fg: string; bg: string; label: string; large?: boolean }[] = [
  { fg: "--foreground", bg: "--background", label: "Text on background" },
  { fg: "--muted", bg: "--background", label: "Muted text on background", large: true },
  { fg: "--accent", bg: "--background", label: "Accent on background", large: true },
  { fg: "--button-fg", bg: "--button-bg", label: "Button text on button" },
];
