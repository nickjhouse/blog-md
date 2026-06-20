import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Caching overrides:
//  - incrementalCache: R2 — stores rendered ISR pages (binding
//    NEXT_INC_CACHE_R2_BUCKET → my-blog-cache).
//  - queue: Durable-Object queue (binding NEXT_CACHE_DO_QUEUE → DOQueueHandler)
//    — synchronises/dedupes time-based revalidations in production.
//  - tagCache: D1 (binding NEXT_TAG_CACHE_D1 → my-blog-tags) — enables
//    on-demand revalidatePath/revalidateTag. Inert until we add those calls
//    (next increment); adding it here just stands up the mechanism.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: d1NextTagCache,
});
