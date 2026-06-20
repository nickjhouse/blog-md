import { ImageResponse } from "next/og";
import { getPostOgData } from "@/lib/seo";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { getOgTheme, OG_FONT_FAMILY, loadOgFont } from "@/lib/og-theme";

// Generated social-share card per post (title + category on a branded card).
// NOTE: no `runtime = "edge"` — OpenNext/Cloudflare runs this in the Node
// runtime. Works in `next dev` locally.
// Reads DB-backed identity + theme, so render at request time (not at build,
// where the runtime secret key is absent).
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// `alt` must be generated (a static export can't read the DB) so it reflects the
// live site name.
export async function generateImageMetadata() {
  const { name } = await getSiteIdentity();
  return [{ id: "og", alt: name, size, contentType }];
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, identity, fontData, ogTheme] = await Promise.all([
    getPostOgData(slug),
    getSiteIdentity(),
    loadOgFont(SITE_URL),
    getOgTheme(),
  ]);
  const title = data?.title ?? identity.name;
  const titleFont = fontData ? OG_FONT_FAMILY : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: ogTheme.bg,
          color: ogTheme.fg,
          padding: "72px",
          borderTop: `10px solid ${ogTheme.accent}`,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: ogTheme.muted }}>
          {identity.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {data?.category ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 600,
                color: ogTheme.accent,
                marginBottom: 16,
              }}
            >
              {data.category}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              // Only set fontFamily when the font actually loaded — passing
              // undefined makes Satori call .split() on it and crash.
              ...(titleFont ? { fontFamily: titleFont } : {}),
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: ogTheme.muted }}>
          Read more →
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: OG_FONT_FAMILY, data: fontData, weight: 600, style: "normal" }]
        : undefined,
    },
  );
}
