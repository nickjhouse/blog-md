import { createAdminClient } from "@/lib/supabase/admin";

// Minimal structural type for the bits of the R2 bucket binding we use, so this
// file doesn't hard-depend on @cloudflare/workers-types being present.
export interface R2Like {
  put(key: string, value: string): Promise<unknown>;
  list(opts?: {
    prefix?: string;
    cursor?: string;
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<void>;
}

// Tables included in the backup. Order roughly parent→child for readability;
// transient/derived tables (newsletter_confirmations) are intentionally omitted.
const BACKUP_TABLES = [
  "profiles",
  "categories",
  "series",
  "posts",
  "tags",
  "post_tags",
  "comments",
  "reactions",
  "bookmarks",
  "media",
  "pages",
  "post_revisions",
  "contact_messages",
  "site_settings",
] as const;

const PAGE = 1000; // Supabase caps a select at 1000 rows — page through.
const KEEP_RUNS = 14; // retain the last N backup runs; older ones are pruned.

export type BackupResult = {
  ok: boolean;
  key?: string;
  tables?: Record<string, number>;
  error?: string;
};

// Dump every backup table to JSONL objects under backups/<timestamp>/, write a
// manifest, then prune old runs. Returns counts per table. Pure data export — no
// auth here; the caller authorizes.
export async function runBackup(bucket: R2Like): Promise<BackupResult> {
  const admin = createAdminClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-"); // sortable, key-safe
  const prefix = `backups/${stamp}`;
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const lines: string[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) return { ok: false, error: `${table}: ${error.message}` };
      const rows = (data ?? []) as unknown[];
      for (const row of rows) lines.push(JSON.stringify(row));
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    counts[table] = lines.length;
    await bucket.put(`${prefix}/${table}.jsonl`, lines.join("\n"));
  }

  await bucket.put(
    `${prefix}/manifest.json`,
    JSON.stringify(
      { created_at: new Date().toISOString(), tables: counts },
      null,
      2,
    ),
  );

  await pruneOldRuns(bucket, KEEP_RUNS);
  return { ok: true, key: prefix, tables: counts };
}

// Keep only the newest `keep` run prefixes; delete objects from older runs.
async function pruneOldRuns(bucket: R2Like, keep: number): Promise<void> {
  const allKeys: string[] = [];
  const runs = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await bucket.list({ prefix: "backups/", cursor });
    for (const o of res.objects) {
      allKeys.push(o.key);
      const m = o.key.match(/^backups\/([^/]+)\//);
      if (m) runs.add(m[1]);
    }
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);

  // Timestamps are fixed-width + lexically sortable → newest last; drop all but
  // the most recent `keep`.
  const stale = [...runs].sort().slice(0, Math.max(0, runs.size - keep));
  if (stale.length === 0) return;
  const staleSet = new Set(stale);
  const toDelete = allKeys.filter((k) => {
    const m = k.match(/^backups\/([^/]+)\//);
    return m ? staleSet.has(m[1]) : false;
  });
  // R2 delete accepts up to 1000 keys per call; chunk to be safe.
  for (let i = 0; i < toDelete.length; i += 1000) {
    await bucket.delete(toDelete.slice(i, i + 1000));
  }
}
