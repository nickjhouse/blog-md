"use client";

import { useEffect, useRef, useState } from "react";

const clamp = (n: number, lo: number, hi: number) =>
  lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, n));

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  // Crop ratio + export width. Defaults to the 2:1 / 1600px cover banner.
  aspect?: number;
  outWidth?: number;
  title?: string;
  fileSuffix?: string;
};

// Dependency-free cover cropper: drag to pan, slider to zoom, canvas export.
// Math uses a normalized center point (cx, cy in 0..1 of the image) + zoom, so
// it stays correct across viewport resizes.
export function CoverCropper({
  file,
  onCancel,
  onConfirm,
  aspect = 2,
  outWidth = 1600,
  title = "Crop cover image",
  fileSuffix = "cover",
}: Props) {
  const ASPECT = aspect;
  const OUT_W = outWidth;
  const OUT_H = Math.round(OUT_W / ASPECT);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const [url, setUrl] = useState<string>("");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [cx, setCx] = useState(0.5);
  const [cy, setCy] = useState(0.5);
  const [working, setWorking] = useState(false);

  // Object URL for the selected file.
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Track the viewport's pixel size (responsive).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () =>
      setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [url]);

  const ready = !!nat && vp.w > 0 && vp.h > 0;
  const coverScale = ready ? Math.max(vp.w / nat!.w, vp.h / nat!.h) : 1;
  const dispW = ready ? nat!.w * coverScale * zoom : 0;
  const dispH = ready ? nat!.h * coverScale * zoom : 0;

  function clampCenter(ncx: number, ncy: number) {
    const minCx = vp.w / 2 / dispW;
    const minCy = vp.h / 2 / dispH;
    return {
      cx: clamp(ncx, minCx, 1 - minCx),
      cy: clamp(ncy, minCy, 1 - minCy),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !ready) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    const next = clampCenter(cx - dx / dispW, cy - dy / dispH);
    setCx(next.cx);
    setCy(next.cy);
  }
  function onPointerUp() {
    drag.current = null;
  }

  function onZoom(z: number) {
    setZoom(z);
    // Re-clamp at the new scale (center point stays fixed).
    const nd = nat!.w * coverScale * z;
    const ndh = nat!.h * coverScale * z;
    const minCx = vp.w / 2 / nd;
    const minCy = vp.h / 2 / ndh;
    setCx((c) => clamp(c, minCx, 1 - minCx));
    setCy((c) => clamp(c, minCy, 1 - minCy));
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || !nat) return;
    setWorking(true);
    try {
      // Source rectangle (in natural pixels) currently visible in the viewport.
      const sw = (vp.w * nat.w) / dispW;
      const sh = (vp.h * nat.h) / dispH;
      const sx = cx * nat.w - sw / 2;
      const sy = cy * nat.h - sh / 2;

      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", 0.85),
      );
      if (!blob) return;
      const base = file.name.replace(/\.[^.]+$/, "");
      onConfirm(
        new File([blob], `${base}-${fileSuffix}.webp`, { type: "image/webp" }),
      );
    } finally {
      setWorking(false);
    }
  }

  const ox = ready ? vp.w / 2 - cx * dispW : 0;
  const oy = ready ? vp.h / 2 - cy * dispH : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-xl border border-(--border) bg-(--surface) p-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-xs text-(--muted)">
          Drag to reposition, use the slider to zoom. Exported at {OUT_W}×{OUT_H}.
        </p>

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mt-3 w-full touch-none overflow-hidden rounded-md border border-(--border) bg-(--hover)"
          style={{ aspectRatio: String(ASPECT), cursor: "move" }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNat({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              style={{
                position: "absolute",
                left: ox,
                top: oy,
                width: dispW || undefined,
                height: dispH || undefined,
                maxWidth: "none",
                userSelect: "none",
              }}
            />
          ) : null}
        </div>

        <label className="mt-3 flex items-center gap-3 text-xs text-(--muted)">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="flex-1"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="rounded-md border border-(--border-strong) px-3 py-1.5 text-sm hover:bg-(--hover) disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={working || !ready}
            className="rounded-md bg-(--button-bg) px-3 py-1.5 text-sm font-medium text-(--button-fg) disabled:opacity-50"
          >
            {working ? "Applying…" : "Apply crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
