# Blog.md

A self-hosted blog / CMS built to run on free tiers. Write posts in Markdown
with image uploads, organize them by category, tag, and series, and let readers
sign in to comment — with moderation, a newsletter, and a full theming system
baked in.

The defaults here are generic, so you can fork, rebrand, and deploy your own.

## Features

- **Authoring** — Markdown editor with live preview, image uploads, cover images, drafts, and scheduled publishing
- **Taxonomy** — categories, tags, and multi-post series
- **Comments** — Google / email sign-in, replies, reactions, bookmarks
- **Moderation** — approval queue, comment reports, user blocking, banned-term filters
- **Media Library** — multi-upload, drag-and-drop, bulk delete, usage tracking
- **Newsletter** — double opt-in signups (Resend), optional auto-send on publish
- **Theming** — in-admin color editor (light/dark) with export / import and save-as-default
- **SEO** — sitemap, RSS, JSON-LD, OpenGraph, and on-domain brand / OG images
- **Ops** — scheduled DB backups to R2, error alerting, optional Cloudflare Web Analytics

## Tech stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** — Postgres, Auth (Google + email/password), and Storage
- **Cloudflare Workers** — hosting via OpenNext (`@opennextjs/cloudflare`), with **R2** (ISR cache + backups) and **D1** (revalidation tag cache)
- Optional: **Resend** (email), **Turnstile** (bot protection), **Sentry** (errors)

Security rests on Postgres **Row Level Security**: only admins publish, only
signed-in non-blocked users comment, and the Supabase **secret key**
(`sb_secret_…`) never reaches the browser — it's used only in server-side routes.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Cloudflare](https://cloudflare.com) account for deployment (free tier works; not needed for local dev)

## Quick start (local)

```bash
npm install
cp .env.example .env.local    # fill in your Supabase URL + keys
npm run dev                   # http://localhost:3000
```

The app boots before Supabase is fully configured — auth and data calls no-op
until the env vars are set.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the Project URL, the **publishable key**
   (`sb_publishable_…`), and the **secret key** (`sb_secret_…`) into `.env.local`.
   Set `ADMIN_EMAIL` to the address you'll sign in with.
3. **SQL Editor**: run the two baseline files in
   [`supabase/migrations/`](./supabase/migrations), **in order**:
   1. `0001_init.sql` — the full schema (tables, enums, RLS policies, the
      `public` + `private` helper functions, grants, indexes).
   2. `0002_baseline_supplement.sql` — the cross-schema pieces a schema dump
      can't carry: the `auth.users` signup trigger, the `ensure_rls` event
      trigger, the storage buckets + their policies, and the `site_settings`
      singleton row. **Both are required** — skip the supplement and signups,
      uploads, and saved settings will silently break.
4. **Authentication → Providers**: enable Email and Google (add your Google
   OAuth credentials).
5. **Create your admin account:** sign up at `/signup` using your `ADMIN_EMAIL`.
   This also creates your `profiles` row via the `on_auth_user_created` trigger
   (confirm the email first if Supabase email-confirmation is enabled). Then set
   the email in [`supabase/seed.sql`](./supabase/seed.sql) to that same address
   and run it to grant the account the `admin` role — after which `/admin` opens.

> **Note.** This baseline is a snapshot of the production schema, so RLS helper
> functions already live in a non-API-exposed `private` schema and the
> service-role-only tables already carry explicit deny-all policies — the
> security hardening is baked in, not applied incrementally. The original
> step-by-step migration history (53 incremental files) lives in the project's
> git history if you ever need to trace how a piece of the schema came to be.

> **Generated types.** `src/lib/supabase/types.ts` is committed and already
> matches this schema, so a fresh install needs nothing. You only regenerate it
> if you later **change** the schema (add a table/column/enum):
> `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`, then
> commit the result. The build never runs this for you.

> **`ensure_rls` / RLS auto-enable.** The baseline installs an `ensure_rls` event
> trigger (its function `rls_auto_enable` lives in `private`) that auto-enables
> RLS on any newly created `public` table — a safety net so a new table is never
> left unprotected. If the Supabase advisor ever flags a **`public.rls_auto_enable`**
> (note: `public`, not `private`), that's a stray duplicate from a separate setup
> snippet, not from this baseline. The baseline's copy is in `private`; drop the
> public one — it's orphaned (the event trigger points at `private`):
> `drop function if exists public.rls_auto_enable();`

## Cloudflare deploy (OpenNext)

1. Create the resources (names are yours to choose — just match them in
   `wrangler.jsonc`):

   ```bash
   wrangler r2 bucket create my-blog-cache
   wrangler r2 bucket create my-blog-backups
   wrangler d1 create my-blog-tags        # copy the printed database_id
   ```

2. Copy the config template and fill in your resource names + the D1
   `database_id`:

   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

3. Provide the env vars in the Cloudflare dashboard (**Worker → Settings →
   Variables**). Keep `SUPABASE_SECRET_KEY` and anything `*_SECRET` as
   **encrypted secrets** (or `wrangler secret put …`); public `NEXT_PUBLIC_*`
   values go under **Build variables**.
4. Deploy:

   ```bash
   npm run deploy        # build + deploy (run `wrangler login` first)
   ```

You can also connect the repo under **Workers & Pages → Connect to Git** — it
detects the OpenNext setup.

## Scheduled jobs (optional)

Auto-sending newsletters on publish and nightly DB backups run through Supabase
**pg_cron** + **pg_net**, which call the `/api/cron/*` routes. Both extensions
(plus **Supabase Vault**) are already installed by the baseline — `0001_init.sql`
creates `pg_cron`, `pg_net`, and `supabase_vault` — so you only need to store the
secret and schedule the jobs.

The cron routes are guarded by a shared `CRON_SECRET` bearer token. To keep that
token out of the job definition, store it in **Supabase Vault** and have the job
read it back at runtime:

1. Set the secret on the Worker (the route validates against it):

   ```bash
   npx wrangler secret put CRON_SECRET     # a long random string, e.g. `openssl rand -base64 32`
   ```

2. Store the **same** value in Vault (SQL Editor):

   ```sql
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```

3. Schedule the job, pulling the token from Vault so it's never written inline
   (SQL Editor):

   ```sql
   select cron.schedule('auto-newsletter', '*/15 * * * *', $$
     select net.http_post(
       url     := 'https://your-domain.com/api/cron/newsletter',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret
                       from vault.decrypted_secrets
                       where name = 'cron_secret')
       ),
       body    := '{}'::jsonb
     );
   $$);
   ```

The nightly backup job reuses the same Vault secret. It writes JSONL snapshots of
every table to the `BACKUP_R2_BUCKET` you created in the Cloudflare step (and
returns `503` until that bucket is bound, so deploy that first). Then schedule it:

```sql
select cron.schedule('db-backup', '0 3 * * *', $$
  select net.http_post(
    url     := 'https://your-domain.com/api/cron/backup',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret
                    from vault.decrypted_secrets
                    where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
$$);
```

Keep the Vault `cron_secret` and the Worker `CRON_SECRET` in sync (Vault feeds
pg_cron; the Worker validates). Everything else works without any of this.

## Bot protection — Turnstile (optional)

Cloudflare Turnstile guards the **newsletter signup** (verified by the app) and
the **auth forms** — signup, login, password reset (verified by Supabase's native
CAPTCHA). The comment form isn't gated — it already requires a signed-in account.
The feature is inert until configured, so you can deploy first and flip it on.
The secret lives in **two different places** depending on which form it protects:

1. **Cloudflare dashboard → Turnstile** → create a widget for your domain; copy
   the **site key** and **secret key** (Managed or Invisible mode both work).
2. **Site key** → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` as a Cloudflare **build**
   variable (inlined client-side, not a runtime secret). This renders the widget
   on the newsletter + auth forms.
3. **Newsletter** → set the secret as a **Worker** runtime secret:
   `npx wrangler secret put TURNSTILE_SECRET_KEY`. `/api/newsletter` enforces it.
4. **Auth forms (the Supabase side)** → Supabase verifies the token, so the secret
   goes in the **Supabase dashboard**, not the Worker:
   **Authentication → Settings → Bot and Abuse Protection (CAPTCHA)** → enable,
   choose **Turnstile**, and paste the **secret key**.

> **Rollout order matters for auth.** Deploy the app *with the site-key build
> variable* **first**, then enable CAPTCHA in Supabase. Once enabled, Supabase
> rejects any auth request without a token, so the widget must already be live —
> and keep the site key set for as long as Supabase CAPTCHA is on, or auth breaks.

## Environment variables

All variables are documented inline in [`.env.example`](./.env.example).

**Required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL`.

**Optional** (each feature stays inert until configured): Resend (`RESEND_*`,
`NOTIFY_*`), Turnstile (`*TURNSTILE*`), Sentry (`NEXT_PUBLIC_SENTRY_LOADER_URL`),
Cloudflare Analytics (`NEXT_PUBLIC_CF_ANALYTICS_TOKEN`), and cron (`CRON_SECRET`).

## Customization

- **Name / tagline / contact** — `src/lib/site.config.ts`, or override at runtime
  in **Settings → Identity**.
- **Brand icon / favicon** — replace `public/brand/icon.svg` and bump the `?v=`
  in `BRAND_ICON` (`src/lib/site.config.ts`). Admins can also upload one in
  **Settings → Brand**.
- **Theme colors** — edit live in **Settings → Theme** (with export / import), or
  change the defaults in `src/app/globals.css` and `src/lib/theme.ts`.

## License

The project code is [MIT](./LICENSE).

Third-party assets keep their own licenses (the MIT license does **not** cover
them): the bundled font **Source Serif 4** (`public/fonts/`) is © Adobe, licensed
under the [SIL Open Font License 1.1](https://openfontlicense.org) — see
`public/fonts/OFL.txt` for the full text and the reserved-font-name notice.
