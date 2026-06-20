import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, parseJson } from "@/lib/route-guards";
import { sendPostNewsletter } from "@/lib/newsletter";

type Ctx = { params: Promise<{ id: string }> };

// Admin: send the post's newsletter broadcast. Published posts only; refuses to
// re-send unless { force: true }. Delegates to the shared sendPostNewsletter
// helper (atomic claim + stamp); maps its result to the existing API responses.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const o = await parseJson<{ force?: boolean }>(req);
  const result = await sendPostNewsletter(id, { force: o.force === true });

  switch (result.status) {
    case "ok":
      return NextResponse.json({ ok: true, sentAt: result.sentAt });
    case "not_configured":
      return NextResponse.json(
        { error: "Newsletter isn’t configured." },
        { status: 503 },
      );
    case "error":
      return NextResponse.json(
        { error: "Couldn’t send the broadcast — please try again." },
        { status: 502 },
      );
    case "skipped":
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }
      if (result.reason === "not_live") {
        return NextResponse.json(
          { error: "Only published (live) posts can be sent." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Already sent." },
        { status: 409 },
      );
  }
}
