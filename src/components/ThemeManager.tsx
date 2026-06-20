"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

// Re-assert the stored theme on the <html> element. The inline <body> script
// handles the very first paint, but the not-found / error renders don't reliably
// keep the script-applied class (Next builds those pages' <head> from metadata
// and the imperative class can be dropped). This re-applies it React-side on
// mount AND on every route change, BEFORE paint (layout effect), so a 404 or any
// navigation can't strand the page in the wrong theme.
function applyStoredTheme() {
  try {
    const t = localStorage.getItem("theme");
    const dark = t
      ? t === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const el = document.documentElement;
    el.classList.toggle("dark", dark);
    el.style.colorScheme = dark ? "dark" : "light";
  } catch {
    // localStorage / matchMedia unavailable — leave defaults.
  }
}

// useLayoutEffect runs before the browser paints (no flash); fall back to
// useEffect during SSR to avoid the "useLayoutEffect does nothing on the server"
// warning.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ThemeManager() {
  const pathname = usePathname();
  useIsomorphicLayoutEffect(() => {
    applyStoredTheme();
  }, [pathname]);
  return null;
}
