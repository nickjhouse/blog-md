import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings, updateSettings } from "@/lib/settings";
import { BRAND_BUCKET } from "@/lib/brand";
import { validateSvgUpload, MAX_SVG_BYTES } from "@/lib/svg-sanitize";
import { revalidateLayout } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

const MAX_PNG_BYTES = 150_000; // 150 KB
const SVG_KEY = "icon.svg";
const PNG_KEY = "icon.png";

// First 8 bytes of every PNG file.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

// Upload a new brand mark (SVG or PNG). Admin-only. The file is validated +
// (for SVG) sanitized server-side BEFORE it touches storage — uploads
// deliberately route through here rather than going browser-direct.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const type = file.type;

  let key: string;
  let body: Uint8Array | string;
  let contentType: string;

  if (type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    if (buf.byteLength > MAX_SVG_BYTES) {
      return NextResponse.json({ error: "SVG is too large (max 100 KB)." }, { status: 400 });
    }
    const result = validateSvgUpload(new TextDecoder().decode(buf));
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    key = SVG_KEY;
    body = result.svg;
    contentType = "image/svg+xml";
  } else if (type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    if (buf.byteLength > MAX_PNG_BYTES) {
      return NextResponse.json({ error: "PNG is too large (max 150 KB)." }, { status: 400 });
    }
    if (!isPng(buf)) {
      return NextResponse.json({ error: "File is not a valid PNG." }, { status: 400 });
    }
    key = PNG_KEY;
    body = buf;
    contentType = "image/png";
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Upload an SVG or PNG." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from(BRAND_BUCKET)
    .upload(key, body, { contentType, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Remove the other format's file so a stale one isn't served after a switch.
  const otherKey = key === SVG_KEY ? PNG_KEY : SVG_KEY;
  await supabase.storage.from(BRAND_BUCKET).remove([otherKey]);

  const current = await getSettings();
  await updateSettings({
    brand_icon_path: key,
    brand_icon_version: current.brand_icon_version + 1,
  });

  // The brand mark renders in the header/footer of every cached page.
  revalidateLayout();
  return NextResponse.json({ ok: true });
}

// Reset to the committed default mark. Admin-only. Clears the stored path (the
// resolver falls back to /public) and bumps the version so caches refresh.
export async function DELETE() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const supabase = createAdminClient();
  await supabase.storage.from(BRAND_BUCKET).remove([SVG_KEY, PNG_KEY]);

  const current = await getSettings();
  await updateSettings({
    brand_icon_path: null,
    brand_icon_version: current.brand_icon_version + 1,
  });

  // Reverting the mark also changes the chrome on every cached page.
  revalidateLayout();
  return NextResponse.json({ ok: true });
}
