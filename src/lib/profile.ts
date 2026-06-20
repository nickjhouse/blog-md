import { createClient } from "@/lib/supabase/server";

// Editable public-profile fields (avatar is granted/edited separately too).
export type ProfileFields = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
  x_url: string | null;
  github_url: string | null;
  bluesky_url: string | null;
  mastodon_url: string | null;
  linkedin_url: string | null;
};

export const PROFILE_FIELD_COLUMNS =
  "full_name, bio, avatar_url, website_url, x_url, github_url, bluesky_url, mastodon_url, linkedin_url";

// The signed-in user's own profile fields (for the account-page editor).
export async function getProfileFields(userId: string): Promise<ProfileFields> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELD_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  const p = data;
  return {
    full_name: p?.full_name ?? null,
    bio: p?.bio ?? null,
    avatar_url: p?.avatar_url ?? null,
    website_url: p?.website_url ?? null,
    x_url: p?.x_url ?? null,
    github_url: p?.github_url ?? null,
    bluesky_url: p?.bluesky_url ?? null,
    mastodon_url: p?.mastodon_url ?? null,
    linkedin_url: p?.linkedin_url ?? null,
  };
}
