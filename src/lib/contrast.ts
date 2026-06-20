import { parseHex } from "@/lib/color";

// WCAG 2.x contrast utilities (dependency-free; runs anywhere). Used by the
// theme editor to WARN (not block) on low-contrast token pairs.

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// Relative luminance per WCAG (0 = black, 1 = white). Invalid hex → 0.
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

// Contrast ratio between two colors, 1 (none) … 21 (black vs white).
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// AA: 4.5:1 for normal text, 3:1 for large text / UI components.
export function meetsAA(ratio: number, large = false): boolean {
  return ratio >= (large ? 3 : 4.5);
}
