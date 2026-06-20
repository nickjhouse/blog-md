import type { Database } from "@/lib/supabase/types";

// Friendly aliases for the database enum types, derived from the generated
// `types.ts` so they can never drift from the schema. Kept in this separate file
// (not in the generated types.ts) so re-running `supabase gen types` never
// clobbers them.
export type PostStatus = Database["public"]["Enums"]["post_status"];
export type CommentStatus = Database["public"]["Enums"]["comment_status"];
export type UserRole = Database["public"]["Enums"]["user_role"];
