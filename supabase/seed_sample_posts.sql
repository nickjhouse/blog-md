-- ===========================================================================
-- Sample posts for development (clean & minimal feed).
-- Safe to run after 0001_init.sql + seed.sql. Idempotent (on conflict by slug).
-- Delete later with:  delete from public.posts where slug in (...);
-- Assumes the starter categories from seed.sql exist (general, tech, personal).
-- ===========================================================================

insert into public.posts (title, slug, category_id, excerpt, body_md, body_html, status, published_at)
values
(
  'Hello, world',
  'hello-world',
  (select id from public.categories where slug = 'general'),
  'Why I started this blog and what to expect here.',
  '# Hello, world',
  '<p>Welcome. This is the first post on my new blog — a small, fast, writing-first space I built from scratch.</p><p>Expect notes on building things, the occasional trip report, and whatever else is on my mind. No newsletter pop-ups, no clutter.</p>',
  'published',
  now() - interval '1 day'
),
(
  'Building this blog with Next.js and Supabase',
  'building-this-blog',
  (select id from public.categories where slug = 'tech'),
  'How the site is wired together — and why it stays free to run.',
  '# Building this blog',
  '<p>This blog runs on <strong>Next.js</strong>, with <strong>Supabase</strong> handling the database, auth, and image storage. It deploys to Cloudflare on a free tier.</p><h2>The data model</h2><p>Posts, categories, and comments live in Postgres. Row Level Security enforces who can do what — only I can publish, and only signed-in readers can comment.</p><ul><li>Posts are written in Markdown and rendered to HTML.</li><li>Categories group posts into feeds.</li><li>Comments require a login.</li></ul><h2>Why this stack</h2><p>It is cheap, it is fast, and the security lives in the database rather than scattered through the app. That last part matters more than it sounds.</p>',
  'published',
  now() - interval '3 days'
),
(
  'On keeping side projects small',
  'keeping-side-projects-small',
  (select id from public.categories where slug = 'tech'),
  'The case for shipping the boring version first.',
  '# On keeping side projects small',
  '<p>Every side project starts with a grand architecture diagram. Most die there too.</p><p>The trick is to ship the smallest thing that works, then resist the urge to scale a problem you do not have yet. Boring and finished beats clever and abandoned.</p><blockquote>Ship the version you would be slightly embarrassed by. Then improve it in public.</blockquote>',
  'published',
  now() - interval '8 days'
),
(
  'A weekend in the mountains',
  'a-weekend-in-the-mountains',
  (select id from public.categories where slug = 'personal'),
  'Trading the laptop for trail dust, and what three days offline did for my focus.',
  '# A weekend in the mountains',
  '<p>I left the laptop at home, which felt reckless right up until it felt like relief.</p><p>Three days of walking, no notifications, and the kind of quiet that reorganizes your thoughts without asking. I came back with nothing to show for it except a clearer head — which, it turns out, was the entire point.</p>',
  'published',
  now() - interval '14 days'
)
on conflict (slug) do nothing;
