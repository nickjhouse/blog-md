// Hand-written augmentation of OpenNext's global `CloudflareEnv` interface for
// this project's *custom* bindings — the ones not already in OpenNext's defaults
// (ASSETS, IMAGES, NEXT_INC_CACHE_R2_BUCKET, NEXT_TAG_CACHE_D1, NEXT_CACHE_DO_QUEUE…).
//
// Why hand-written and not `wrangler types`: that command pulls in
// @cloudflare/workers-types, whose global declarations (caches, Request, …)
// collide with the DOM lib that Next requires (tsconfig `lib: ["dom", …]`). This
// project deliberately stays on the DOM lib and hand-rolls minimal binding
// interfaces (e.g. `R2Like`) instead.
//
// Add custom bindings here as they're introduced, typed with a minimal
// hand-rolled interface.
import type { R2Like } from "@/lib/backup";

declare global {
  interface CloudflareEnv {
    BACKUP_R2_BUCKET?: R2Like;
  }

  // Cloudflare Workers exposes a default edge cache at `caches.default` that the
  // DOM lib's CacheStorage doesn't declare. Add it (typed as the DOM `Cache`,
  // whose match/put are signature-compatible for this use) so /brand-logo can
  // edge-cache without pulling in @cloudflare/workers-types.
  interface CacheStorage {
    default: Cache;
  }
}

export {};
