import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/media-url";

// Client-side image upload, shared by the editor and the Media Library.
// Downscales rasters to WebP ≤maxWidth, uploads to the post-images bucket with
// an immutable cache header, and records metadata in the media table.

async function downscale(
  file: File,
  maxWidth = 1600,
  quality = 0.85,
): Promise<{ file: File; width: number | null; height: number | null }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return { file, width: null, height: null };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const ow = bitmap.width;
    const oh = bitmap.height;
    if (ow <= maxWidth) {
      bitmap.close?.();
      return { file, width: ow, height: oh };
    }
    const w = maxWidth;
    const h = Math.round((oh * maxWidth) / ow);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return { file, width: ow, height: oh };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", quality),
    );
    if (!blob || blob.size >= file.size) {
      return { file, width: ow, height: oh };
    }
    const base = file.name.replace(/\.[^.]+$/, "");
    return {
      file: new File([blob], `${base}.webp`, { type: "image/webp" }),
      width: w,
      height: h,
    };
  } catch {
    return { file, width: null, height: null };
  }
}

export type Uploaded = { url: string; path: string };

export async function uploadImage(file: File): Promise<Uploaded> {
  const supabase = createClient();
  const { file: optimized, width, height } = await downscale(file);
  const ext = optimized.name.includes(".")
    ? optimized.name.split(".").pop()
    : "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, optimized, {
      cacheControl: "31536000",
      upsert: false,
      contentType: optimized.type,
    });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

  // Record metadata (best-effort; the file is the source of truth).
  await fetch("/api/admin/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      size_bytes: optimized.size,
      content_type: optimized.type,
      width,
      height,
    }),
  }).catch(() => {});

  return { url: data.publicUrl, path };
}
