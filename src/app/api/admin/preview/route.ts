import { NextResponse, type NextRequest } from "next/server";
import { requireContributor, parseJson } from "@/lib/route-guards";
import { markdownToSafeHtml } from "@/lib/markdown";
import { imageDimensions } from "@/lib/media";
import { bucketPathsIn } from "@/lib/media-url";
import { createAdminClient } from "@/lib/supabase/admin";

// Converts markdown -> sanitized HTML for the editor Preview tab. Contributors
// (authors + admins), and uses the exact same conversion as publishing.
export async function POST(req: NextRequest) {
  const gate = await requireContributor();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson(req);
  const bodyMd = typeof o.body_md === "string" ? o.body_md : null;
  if (bodyMd === null) {
    return NextResponse.json({ error: "body_md required" }, { status: 400 });
  }

  // Stamp known image dimensions (same as the publish path) so preview images
  // reserve their space — otherwise the slot collapses and re-expands on every
  // keystroke-debounced re-render and the preview flickers.
  const dims = await imageDimensions(createAdminClient(), bucketPathsIn(bodyMd));
  const html = await markdownToSafeHtml(bodyMd, dims);
  return NextResponse.json({ html });
}
