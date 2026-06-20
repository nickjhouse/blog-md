"use client";

import Link from "next/link";
import { useSession } from "./SessionProvider";

// Client-rendered Edit affordance: shown only to an admin or the post's own
// author, decided from the client session (so the post page's server render
// carries no per-user state and stays cache-safe). Real authorization is still
// enforced server-side on /admin/edit and the post-update route.
export function EditPostButton({
  postId,
  authorId,
}: {
  postId: string;
  authorId: string | null;
}) {
  const { session } = useSession();
  if (!session) return null;
  if (!session.isAdmin && session.userId !== authorId) return null;
  return (
    <Link
      href={`/admin/edit/${postId}`}
      className="rounded-md border border-[color:var(--border-strong)] px-3 py-1 text-sm hover:bg-[color:var(--hover)]"
    >
      Edit
    </Link>
  );
}
