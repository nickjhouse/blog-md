import { BRAND_ICON, SITE_URL } from "@/lib/site.config";
import type { SiteSettings } from "@/lib/settings";

// Storage bucket holding an admin-uploaded brand mark (favicon + nav logo).
export const BRAND_BUCKET = "brand";

// Resolve the brand icon URL for BOTH the favicon (metadata.icons) and the nav
// logo. Returns the admin-uploaded mark from Supabase Storage (with a cache-bust
// version) when set, otherwise the committed default in /public. Keeping the
// committed file as the permanent fallback means an empty/failed settings read
// renders exactly today's icon.
export function resolveBrandIcon(settings: SiteSettings): string {
  if (settings.brand_icon_path) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (base) {
      const path = settings.brand_icon_path.replace(/^\/+/, "");
      return `${base}/storage/v1/object/public/${BRAND_BUCKET}/${path}?v=${settings.brand_icon_version}`;
    }
  }
  return BRAND_ICON;
}

// Absolute, same-origin URL for the brand mark — used as the Organization logo
// in structured data so the markup reads the site's own domain (not the Supabase
// storage host). Served by the /brand-logo route. Versioned to bust caches.
export function brandLogoUrl(settings: SiteSettings): string {
  return `${SITE_URL}/brand-logo?v=${settings.brand_icon_version}`;
}

// MIME type for the favicon <link>, derived from the stored file extension.
export function brandIconMimeType(settings: SiteSettings): string {
  if (settings.brand_icon_path?.toLowerCase().endsWith(".png")) {
    return "image/png";
  }
  return "image/svg+xml";
}
