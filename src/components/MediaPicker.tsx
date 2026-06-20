"use client";

import { MediaBrowser } from "@/components/MediaBrowser";

type CropPreset = { aspect: number; outWidth: number; title: string };

// Modal wrapper: pick an existing image or upload a new one. Used by the editor
// for cover / OG / inline images.
export function MediaPicker({
  onSelect,
  onClose,
  crop,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
  crop?: CropPreset;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose image"
    >
      <div className="mt-10 w-full max-w-2xl rounded-xl border border-(--border) bg-(--surface) p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Choose image</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-(--muted) hover:underline"
          >
            Close
          </button>
        </div>
        <div className="mt-3">
          <MediaBrowser
            mode="pick"
            crop={crop}
            onSelect={(url) => {
              onSelect(url);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
