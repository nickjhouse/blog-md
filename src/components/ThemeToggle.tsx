"use client";

import { useSyncExternalStore } from "react";

// The active theme lives on <html class="dark">. Read it reactively via
// useSyncExternalStore (a MutationObserver on the class attribute) so the button
// reflects the live theme WITHOUT a mount effect + setState (which
// react-hooks/set-state-in-effect flags). getServerSnapshot returns light, so
// SSR / pre-hydration renders the neutral moon icon — same flash-avoidance the
// old `ready` flag provided.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    // Mutate the DOM; the MutationObserver above re-reads the snapshot and
    // re-renders this button. No setState needed.
    document.documentElement.classList.toggle("dark", next);
    // Keep the inline color-scheme in sync too. The boot script sets it inline,
    // which overrides the `.dark { color-scheme }` CSS rule — so native controls
    // (checkboxes, scrollbars) would otherwise stay on the old theme until a
    // navigation re-ran ThemeManager.
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="text-(--muted) hover:text-(--foreground)"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
      </svg>
    </button>
  );
}
