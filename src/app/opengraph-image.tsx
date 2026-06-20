import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site.config";
import { getSiteIdentity } from "@/lib/identity";
import { getOgTheme, OG_FONT_FAMILY, loadOgFont } from "@/lib/og-theme";

// Site-wide default OG card (home page + any page without its own image).
// Reads DB-backed identity + theme, so render at request time (not at build,
// where the runtime secret key is absent).
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// `alt` must be generated (a static export can't read the DB), so the social-card
// alt text reflects the live site name.
export async function generateImageMetadata() {
  const { name } = await getSiteIdentity();
  return [{ id: "default", alt: name, size, contentType }];
}

export default async function Image() {
  const [fontData, identity, ogTheme] = await Promise.all([
    loadOgFont(SITE_URL),
    getSiteIdentity(),
    getOgTheme(),
  ]);
  const titleFont = fontData ? OG_FONT_FAMILY : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: ogTheme.bg,
          color: ogTheme.fg,
          padding: "72px",
          borderTop: `10px solid ${ogTheme.accent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            height: 6,
            width: 96,
            backgroundColor: ogTheme.accent,
            borderRadius: 3,
            marginBottom: 28,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            // Only set fontFamily when the font actually loaded — passing
            // undefined makes Satori call .split() on it and crash.
            ...(titleFont ? { fontFamily: titleFont } : {}),
          }}
        >
          {identity.name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: ogTheme.muted,
            marginTop: 16,
          }}
        >
          {identity.description}
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
