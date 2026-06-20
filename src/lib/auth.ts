import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/enums";

type AuthUser = { id: string; email: string | null };

// Memoize the auth + profile lookups for the lifetime of a single server
// request, so the layout and the page share one result.
//
// We use getClaims() rather than getUser(): with asymmetric JWT signing keys it
// verifies the token locally (WebCrypto + cached JWKS) with no network call,
// and it still refreshes an expiring session via the refresh token. With the
// legacy symmetric secret it transparently falls back to a verified getUser()
// network call, so this is safe before AND after rotating the signing key.
// Authorization stays database-driven (role / is_blocked via RLS), so the
// "no per-request server-side revocation check" trade-off is cosmetic here.
const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { sub?: string; email?: string | null }
    | undefined;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? null };
});

export type ViewerContext = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  // Derived from role: admin === "admin"; author covers author OR admin.
  isAdmin: boolean;
  isAuthor: boolean;
  isBlocked: boolean;
  notifyOnReply: boolean;
};

// Full context for the signed-in viewer (or null if signed out). Used for the
// nav state, the comment form, and moderation controls.
export const getViewerContext = cache(
  async (): Promise<ViewerContext | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role, is_blocked, notify_on_reply")
      .eq("id", user.id)
      .maybeSingle();

    const role: UserRole = profile?.role ?? "reader";

    return {
      userId: user.id,
      email: user.email,
      displayName: profile?.display_name ?? null,
      role,
      isAdmin: role === "admin",
      isAuthor: role === "admin" || role === "author",
      isBlocked: profile?.is_blocked ?? false,
      notifyOnReply: profile?.notify_on_reply ?? true,
    };
  },
);

export type AdminContext = {
  userId: string;
  displayName: string | null;
};

// Returns the current user if they are an admin, otherwise null. Reuses the
// cached viewer context (no extra network calls).
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const viewer = await getViewerContext();
  if (!viewer?.isAdmin) return null;
  return { userId: viewer.userId, displayName: viewer.displayName };
});

export type ContributorContext = {
  userId: string;
  displayName: string | null;
  isAdmin: boolean;
};

// Returns the current user if they can author posts (author OR admin), else
// null. Used to admit authors into the post-editing surface; routes/pages still
// enforce per-post ownership and keep admin-only tools behind getAdminContext.
export const getContributorContext = cache(
  async (): Promise<ContributorContext | null> => {
    const viewer = await getViewerContext();
    if (!viewer?.isAuthor) return null;
    return {
      userId: viewer.userId,
      displayName: viewer.displayName,
      isAdmin: viewer.isAdmin,
    };
  },
);

// True if someone is signed in (admin or not).
export const getSignedInUserId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id ?? null;
});

// True when the viewer has a verified MFA factor but their session hasn't been
// stepped up to aal2 yet — i.e. they still owe a TOTP challenge. Used to gate
// admin surfaces (send them to /verify) and to decide post-login routing.
//
// We read the assurance level from the VERIFIED claims (getClaims) and the factor
// list from the VERIFIED getUser() — NOT getAuthenticatorAssuranceLevel(), which
// reads getSession() internally and triggers supabase's "user may be insecure"
// warning on every admin render. getUser() is only called when still at aal1
// (the case that might need a step-up), so already-stepped-up sessions stay cheap.
export const getMfaStepUpRequired = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const aal = (claimsData?.claims as { aal?: string } | undefined)?.aal;
  if (error || !aal || aal === "aal2") return false; // signed out or stepped up
  const { data: userData } = await supabase.auth.getUser();
  return (userData.user?.factors ?? []).some((f) => f.status === "verified");
});
