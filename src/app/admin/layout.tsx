import { redirect } from "next/navigation";
import { getViewerContext, getMfaStepUpRequired } from "@/lib/auth";

// Guards every /admin route. Admits CONTRIBUTORS (authors + admins); readers go
// home, logged-out users to sign-in. This is the coarse gate — each admin-only
// page re-checks for admin via getAdminContext, and every /api/admin/* route
// re-checks independently. Authors only reach the dashboard + post editor.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isAuthor) redirect("/");

  // If they have MFA enrolled but the session is still aal1, force the step-up
  // before any admin surface loads. (Users without a factor are unaffected.)
  if (await getMfaStepUpRequired()) redirect("/verify?next=/admin");

  return <>{children}</>;
}
