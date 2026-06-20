import { type NextRequest, NextResponse } from "next/server";

// Browsers auto-probe /favicon.ico regardless of the <link rel="icon"> we emit
// (which points at /brand-logo). Redirect that probe to the same dynamic
// resolver so it returns the live admin-configured mark (uploaded or the
// committed default) instead of 404ing — no static file, so nothing competes
// with the metadata icon link.
export const dynamic = "force-dynamic";

export function GET(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/brand-logo", req.url), 307);
}
