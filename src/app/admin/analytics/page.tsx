import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth";
import { getAnalyticsSummary } from "@/lib/analytics";

export const metadata: Metadata = { title: "Analytics" };
// Always reflect the latest events.
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  newsletter_signup: "Newsletter signups",
  share: "Shares",
  search: "Searches",
};

export default async function AdminAnalyticsPage() {
  if (!(await getAdminContext())) redirect("/admin");
  const s = await getAnalyticsSummary(30);
  const known = ["newsletter_signup", "share", "search"];
  const countFor = (name: string) =>
    s.byName.find((b) => b.name === name)?.count ?? 0;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Link
          href="/admin"
          className="text-sm text-(--muted) hover:underline"
        >
          ← Posts
        </Link>
      </div>
      <p className="mt-2 text-sm text-(--muted)">
        Custom events from the last {s.days} days. Pageviews live in Cloudflare
        Web Analytics.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {known.map((name) => (
          <div
            key={name}
            className="rounded-xl border border-(--border) bg-(--surface) p-4"
          >
            <div className="text-xs text-(--muted)">
              {LABELS[name] ?? name}
            </div>
            <div className="mt-1 text-2xl font-semibold">{countFor(name)}</div>
          </div>
        ))}
      </div>

      {s.shareByNetwork.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-serif text-lg font-semibold">Shares by network</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {s.shareByNetwork.map((n) => (
              <li key={n.network} className="flex justify-between">
                <span className="capitalize">{n.network}</span>
                <span className="text-(--muted)">{n.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.topSearches.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-serif text-lg font-semibold">Top searches</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {s.topSearches.map((row) => (
              <li key={row.query} className="flex justify-between gap-4">
                <span className="truncate">{row.query}</span>
                <span className="text-(--muted)">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.zeroResultSearches.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-serif text-lg font-semibold">
            Searches with no results
          </h2>
          <p className="mt-1 text-xs text-(--muted)">
            Content gaps — what people looked for and didn’t find.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {s.zeroResultSearches.map((row) => (
              <li key={row.query} className="flex justify-between gap-4">
                <span className="truncate">{row.query}</span>
                <span className="text-(--muted)">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="font-serif text-lg font-semibold">Recent events</h2>
        {s.recent.length === 0 ? (
          <p className="mt-2 text-sm text-(--muted)">
            No events yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-black/10 text-sm dark:divide-white/10">
            {s.recent.map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium">{LABELS[e.name] ?? e.name}</span>
                  {e.path ? (
                    <span className="text-(--muted)"> · {e.path}</span>
                  ) : null}
                </span>
                <span className="text-(--muted)">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
