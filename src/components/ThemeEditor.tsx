"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { ThemeOverrides } from "@/lib/settings";
import {
  THEME_TOKENS,
  CORE_TOKENS,
  getEffectiveTheme,
  CONTRAST_PAIRS,
  isThemeTokenName,
  type ThemeMode,
  type ThemeToken,
} from "@/lib/theme";
import { contrastRatio, meetsAA } from "@/lib/contrast";
import {
  isHexColor,
  hexToHsv,
  hsvToHex,
  parseHex,
  rgbToHex,
} from "@/lib/color";

type Map = Record<string, string>;

// Keep only known token names mapped to valid hex — mirrors the server's
// allowlist (theme PUT route) so an imported file can't inject arbitrary CSS.
function cleanImportedMode(input: unknown): Map {
  const out: Map = {};
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === "string" && isThemeTokenName(k) && isHexColor(v)) {
        out[k] = v.toLowerCase();
      }
    }
  }
  return out;
}

// Expand #rgb → #rrggbb and guard invalid values so swatches always render.
function toColorInput(v: string): string {
  const short = /^#([0-9a-fA-F]{3})$/.exec(v);
  if (short) return "#" + short[1].split("").map((c) => c + c).join("");
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
}

// Text input that lets you type freely while focused, but snaps to the canonical
// value (from the picker) when blurred. Commits only when the input is valid.
function FieldInput({
  value,
  valid,
  commit,
  ariaLabel,
  className,
}: {
  value: string;
  valid: (v: string) => boolean;
  commit: (v: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={focused ? text : value}
      onFocus={() => {
        setFocused(true);
        setText(value);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (valid(v)) commit(v);
      }}
      className={className}
    />
  );
}

// In-page color popover (replaces <input type="color">, whose OS-native panel
// can't be dismissed by clicking the page). Saturation/value square + hue bar +
// editable hex and R/G/B fields.
function ColorPopover({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState(
    () => hexToHsv(toColorInput(value)) ?? { h: 0, s: 0, v: 100 },
  );

  const hex = hsvToHex(hsv);
  const rgb = parseHex(hex) ?? { r: 0, g: 0, b: 0 };

  function update(p: Partial<typeof hsv>) {
    const next = { ...hsv, ...p };
    setHsv(next);
    onChange(hsvToHex(next));
  }

  function commitHex(v: string) {
    const h = hexToHsv(v);
    if (h) {
      setHsv(h);
      onChange(hsvToHex(h));
    }
  }

  function commitChannel(ch: "r" | "g" | "b", v: string) {
    const next = { ...rgb, [ch]: Math.max(0, Math.min(255, parseInt(v, 10))) };
    const hx = rgbToHex(next.r, next.g, next.b);
    const h = hexToHsv(hx);
    if (h) {
      setHsv(h);
      onChange(hx);
    }
  }

  const channelValid = (v: string) => /^\d{1,3}$/.test(v) && Number(v) <= 255;

  function dragSV(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const move = (cx: number, cy: number) => {
      const x = Math.min(Math.max(cx - rect.left, 0), rect.width);
      const y = Math.min(Math.max(cy - rect.top, 0), rect.height);
      update({ s: (x / rect.width) * 100, v: (1 - y / rect.height) * 100 });
    };
    move(e.clientX, e.clientY);
    const mm = (ev: MouseEvent) => move(ev.clientX, ev.clientY);
    const mu = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
  }

  function dragHue(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const move = (cx: number) =>
      update({ h: (Math.min(Math.max(cx - rect.left, 0), rect.width) / rect.width) * 360 });
    move(e.clientX);
    const mm = (ev: MouseEvent) => move(ev.clientX);
    const mu = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
  }

  return (
    <div className="absolute left-0 top-9 z-50 w-56 rounded-md border border-(--border) bg-(--surface) p-2 shadow-lg">
      <div
        onMouseDown={dragSV}
        className="relative h-28 w-full cursor-crosshair rounded-sm"
        style={{ background: `hsl(${hsv.h}deg 100% 50%)` }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-sm"
          style={{ background: "linear-gradient(to right,#fff,rgba(255,255,255,0))" }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-sm"
          style={{ background: "linear-gradient(to top,#000,rgba(0,0,0,0))" }}
        />
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, boxShadow: "0 0 0 1px rgba(0,0,0,.4)" }}
        />
      </div>
      <div
        onMouseDown={dragHue}
        className="relative mt-2 h-3 w-full cursor-pointer rounded-sm"
        style={{
          background:
            "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
          style={{ left: `${(hsv.h / 360) * 100}%`, boxShadow: "0 0 0 1px rgba(0,0,0,.4)" }}
        />
      </div>

      {/* Editable hex + RGB. Type freely; commits on valid input. */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="w-7 shrink-0 text-xs text-(--muted)">Hex</span>
        <FieldInput
          value={hex}
          valid={isHexColor}
          commit={commitHex}
          ariaLabel="Hex value"
          className="w-full rounded-sm border border-(--border) bg-(--background) px-1.5 py-1 text-xs"
        />
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {(["r", "g", "b"] as const).map((ch) => (
          <label key={ch} className="flex items-center gap-1">
            <span className="text-xs uppercase text-(--muted)">{ch}</span>
            <FieldInput
              value={String(rgb[ch])}
              valid={channelValid}
              commit={(v) => commitChannel(ch, v)}
              ariaLabel={`${ch.toUpperCase()} channel`}
              className="w-full rounded-sm border border-(--border) bg-(--background) px-1 py-1 text-xs"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// Swatch button that toggles the popover; closes on outside click / Escape.
function ColorField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (hex: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-8 shrink-0 cursor-pointer rounded-sm border border-(--border)"
        style={{ background: toColorInput(value) }}
      />
      {open ? <ColorPopover value={value} onChange={onChange} /> : null}
    </div>
  );
}

function varsStyle(eff: Map): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(eff)) style[k] = v;
  return style as React.CSSProperties;
}

// Faithful preview of the generated social card (opengraph-image.tsx): always
// the DARK palette, accent top-border + bar, big serif title, muted tagline.
// Uses container query units (cqw) so the 1200×630 proportions scale to width.
function OgCardPreview({
  eff,
  name,
  description,
}: {
  eff: Map;
  name: string;
  description: string;
}) {
  return (
    <div className="mt-5">
      <div className="mb-1 text-xs text-(--muted)">
        Social card preview — always rendered in dark mode
      </div>
      <div
        style={{
          containerType: "inline-size",
          aspectRatio: "1200 / 630",
          width: "100%",
          maxWidth: 600,
          background: eff["--background"],
          color: eff["--foreground"],
          borderTop: `0.83cqw solid ${eff["--accent"]}`,
          borderRadius: 8,
          padding: "6cqw",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "8cqw",
            height: "0.5cqw",
            background: eff["--accent"],
            borderRadius: "0.25cqw",
            marginBottom: "2.3cqw",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "7cqw",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: "2.67cqw", color: eff["--muted"], marginTop: "1.3cqw" }}>
          {description}
        </div>
      </div>
    </div>
  );
}

function Preview({ eff, label }: { eff: Map; label: string }) {
  return (
    <div className="flex-1">
      <div className="mb-1 text-xs text-(--muted)">{label}</div>
      <div
        style={varsStyle(eff)}
        className="rounded-lg p-4"
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          className="rounded-md p-4"
        >
          <div className="font-serif text-lg font-semibold">Aa Heading</div>
          <p className="mt-1 text-sm">The quick brown fox jumps over it.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Muted secondary text.
          </p>
          <a className="mt-1 inline-block text-sm" style={{ color: "var(--accent)" }}>
            An accent link
          </a>
          <div className="mt-3">
            <span
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--button-bg)", color: "var(--button-fg)" }}
            >
              Button
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// "Advanced" token visibility is a persisted client preference. Read it via
// useSyncExternalStore (not a mount effect + setState) so it's SSR-safe and
// clean under react-hooks/set-state-in-effect. A custom event keeps the current
// tab in sync on write; the native storage event covers other tabs.
const ADVANCED_KEY = "themeEditor.advanced";
const ADVANCED_EVENT = "themeEditor:advanced-change";

function readAdvanced() {
  try {
    return localStorage.getItem(ADVANCED_KEY) === "1";
  } catch {
    return false;
  }
}
function writeAdvanced(value: boolean) {
  try {
    localStorage.setItem(ADVANCED_KEY, value ? "1" : "0");
  } catch {
    // ignore (private mode, etc.)
  }
  window.dispatchEvent(new Event(ADVANCED_EVENT));
}
function subscribeAdvanced(onChange: () => void) {
  window.addEventListener(ADVANCED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ADVANCED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeEditor({
  overrides,
  defaultOverrides,
  ogName,
  ogDescription,
}: {
  overrides: ThemeOverrides;
  defaultOverrides: ThemeOverrides;
  ogName: string;
  ogDescription: string;
}) {
  const router = useRouter();
  const [light, setLight] = useState<Map>(overrides.light ?? {});
  const [dark, setDark] = useState<Map>(overrides.dark ?? {});
  // The saved-default snapshot — the target of "Reset to default". Tracked in
  // state so it updates immediately after "Save as default" (no refresh wait).
  const [savedDefault, setSavedDefault] = useState<ThemeOverrides>(defaultOverrides);
  const advanced = useSyncExternalStore(
    subscribeAdvanced,
    readAdvanced,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);


  const ov: ThemeOverrides = useMemo(() => ({ light, dark }), [light, dark]);
  const effLight = useMemo(() => getEffectiveTheme(ov, "light"), [ov]);
  const effDark = useMemo(() => getEffectiveTheme(ov, "dark"), [ov]);
  const eff = (m: ThemeMode) => (m === "light" ? effLight : effDark);

  const setToken = (mode: ThemeMode, name: string, value: string) => {
    setSaved(false);
    const apply = mode === "light" ? setLight : setDark;
    apply((prev) => ({ ...prev, [name]: value }));
  };

  const visibleTokens: ThemeToken[] = advanced ? THEME_TOKENS : CORE_TOKENS;

  // Whether a default snapshot exists. When none, "Reset to default" would be
  // identical to "Reset to built-in", so we hide it.
  const hasDefault = useMemo(
    () =>
      Object.keys(savedDefault.light ?? {}).length > 0 ||
      Object.keys(savedDefault.dark ?? {}).length > 0,
    [savedDefault],
  );

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setSaved(false);
    const res = await fetch("/api/admin/settings/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ light, dark }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Save failed.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  // Apply the current theme live AND store it as the saved default — the target
  // that "Reset to default" reverts to.
  async function saveDefault() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setSaved(false);
    const res = await fetch("/api/admin/settings/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ light, dark, asDefault: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Save failed.");
      return;
    }
    setSavedDefault({ light, dark });
    setNotice("Saved as your default.");
    router.refresh();
  }

  // Revert the live theme to the saved default snapshot.
  async function resetToDefault() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/settings/theme", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("Reset failed.");
      return;
    }
    setLight(savedDefault.light ?? {});
    setDark(savedDefault.dark ?? {});
    setSaved(true);
    router.refresh();
  }

  // Clear all overrides — the live theme falls back to the globals.css built-in
  // palette. The saved default is left intact.
  async function resetToBuiltin() {
    if (
      !confirm(
        "Reset the live theme to the built-in defaults? Your saved default isn’t affected.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/settings/theme", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Reset failed.");
      return;
    }
    setLight({});
    setDark({});
    setSaved(true);
    router.refresh();
  }

  // Download the current theme as a JSON file. Exports the FULL effective theme
  // (every token's resolved value), not just the explicit overrides — so an
  // export at the built-in default produces the complete default palette rather
  // than an empty {} (which is what the raw-overrides export gave). We pull the
  // 13 real tokens from the effective maps. The `type`/`version` wrapper lets
  // import sanity-check the file.
  function exportTheme() {
    const fullTheme = (eff: Map): Map => {
      const out: Map = {};
      for (const t of THEME_TOKENS) out[t.name] = eff[t.name];
      return out;
    };
    const payload = {
      type: "blog-theme",
      version: 1,
      theme: { light: fullTheme(effLight), dark: fullTheme(effDark) },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blog-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load a theme file into the editor as a PREVIEW (validated against the
  // allowlist); the user reviews it live and clicks Save to persist.
  async function importTheme(file: File) {
    setError(null);
    setNotice(null);
    setSaved(false);
    try {
      const data = JSON.parse(await file.text());
      if (data?.type !== "blog-theme" || !data?.theme) {
        setError("That doesn’t look like a valid theme file.");
        return;
      }
      setLight(cleanImportedMode(data.theme.light));
      setDark(cleanImportedMode(data.theme.dark));
      setNotice("Theme imported — review the preview, then Save to apply.");
    } catch {
      setError("Could not read that file — is it valid JSON?");
    }
  }

  function warnings(mode: ThemeMode) {
    const e = eff(mode);
    return CONTRAST_PAIRS.flatMap((p) => {
      const ratio = contrastRatio(e[p.fg], e[p.bg]);
      if (meetsAA(ratio, p.large)) return [];
      return [`${p.label}: ${ratio.toFixed(1)}:1 (below AA)`];
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-(--muted)">
          Recolor the site for light and dark mode. Unchanged tokens use the
          built-in defaults; interaction shades (hover, strong border) are derived
          automatically from your core picks.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => writeAdvanced(e.target.checked)}
          />
          Advanced
        </label>
      </div>

      {/* Live preview */}
      <div className="mt-5 flex flex-wrap gap-4">
        <Preview eff={effLight} label="Light" />
        <Preview eff={effDark} label="Dark" />
      </div>

      {/* OG/social-card preview (always dark, uses the dark palette). */}
      <OgCardPreview eff={effDark} name={ogName} description={ogDescription} />

      {/* Contrast warnings */}
      {(["light", "dark"] as ThemeMode[]).map((mode) => {
        const w = warnings(mode);
        if (!w.length) return null;
        return (
          <div
            key={mode}
            className="mt-3 rounded-md border border-(--border) p-3 text-sm"
          >
            <span className="font-medium capitalize text-(--danger)">
              {mode} contrast warnings
            </span>
            <ul className="mt-1 list-disc pl-5 text-(--muted)">
              {w.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* Token pickers */}
      <div className="mt-6 space-y-1">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-1 pb-1 text-xs text-(--muted)">
          <span>Token</span>
          <span className="w-28 text-center">Light</span>
          <span className="w-28 text-center">Dark</span>
        </div>
        {visibleTokens.map((t) => (
          <div
            key={t.name}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-md px-1 py-1.5 hover:bg-(--hover)"
          >
            <span className="text-sm">
              {t.label}
              {t.group !== "core" ? (
                <span className="ml-2 text-xs text-(--muted)">
                  {t.group}
                </span>
              ) : null}
            </span>
            {(["light", "dark"] as ThemeMode[]).map((mode) => {
              const value = eff(mode)[t.name];
              return (
                <span key={mode} className="flex w-28 items-center gap-1.5">
                  <ColorField
                    value={value}
                    onChange={(hex) => setToken(mode, t.name, hex)}
                    ariaLabel={`${t.label} ${mode}`}
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (isHexColor(v)) setToken(mode, t.name, v);
                    }}
                    className="w-full rounded-sm border border-(--border) bg-(--surface) px-1.5 py-1 text-xs"
                  />
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-(--button-bg) px-3 py-1.5 text-sm font-medium text-(--button-fg) disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save theme"}
        </button>
        <button
          type="button"
          onClick={saveDefault}
          disabled={busy}
          title="Apply this theme and store it as the default that Reset to default reverts to."
          className="rounded-md border border-(--border-strong) px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Save as default
        </button>
        {saved ? (
          <span className="text-sm text-(--success)">Saved.</span>
        ) : null}
        {error ? (
          <span className="text-sm text-(--danger)">{error}</span>
        ) : null}
        {notice ? (
          <span className="text-sm text-(--muted)">{notice}</span>
        ) : null}
      </div>

      {/* Resets. "Reset to default" reverts the live theme to the saved snapshot
          (only shown once one exists); "Reset to built-in" clears to globals.css. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {hasDefault ? (
          <button
            type="button"
            onClick={resetToDefault}
            disabled={busy}
            className="text-(--muted) hover:text-(--foreground) hover:underline disabled:opacity-50"
          >
            Reset to default
          </button>
        ) : null}
        <button
          type="button"
          onClick={resetToBuiltin}
          disabled={busy}
          className="text-(--muted) hover:text-(--foreground) hover:underline disabled:opacity-50"
        >
          Reset to built-in
        </button>
      </div>

      {/* Backup / restore. Export serializes the current editor theme to a JSON
          file; Import loads one back in as a live preview (Save to apply). */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={exportTheme}
          className="text-(--muted) hover:text-(--foreground) hover:underline"
        >
          Export theme
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-(--muted) hover:text-(--foreground) hover:underline"
        >
          Import theme
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importTheme(file);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}
