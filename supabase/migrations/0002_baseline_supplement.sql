-- ===========================================================================
-- BASELINE SUPPLEMENT — run AFTER the schema.sql dump (which creates the public
-- + private schemas, tables, enums, functions, policies, and grants).
--
-- A `pg_dump --schema public,private` cannot capture cross-schema, global, or
-- data objects, so these four pieces are added by hand. Without them a fresh
-- install looks fine but is quietly broken: no profile on signup, RLS not
-- auto-enabled on new tables, uploads denied, and settings that won't save.
-- ===========================================================================

-- 1) Signup trigger on auth.users → creates a profile row for each new user.
--    (handle_new_user now lives in `private`; the trigger is on the `auth`
--    schema, which the public/private dump doesn't include.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- 2) Event trigger that auto-enables RLS on any newly created public table.
--    (Global object — never in a schema dump.)
drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  execute function private.rls_auto_enable();

-- 3) Storage buckets (data) + their write policies (storage schema). All three
--    buckets are public (objects serve via public URL); there are intentionally
--    NO public SELECT policies (a public bucket doesn't need one, and one would
--    let anon enumerate the file list). Write policies reference the now-private
--    helper functions.
insert into storage.buckets (id, name, public) values
  ('post-images', 'post-images', true),
  ('brand', 'brand', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "contributors write post images" on storage.objects;
create policy "contributors write post images"
  on storage.objects for all
  using (bucket_id = 'post-images' and private.is_author())
  with check (bucket_id = 'post-images' and private.is_author());

drop policy if exists "brand admin write" on storage.objects;
create policy "brand admin write"
  on storage.objects for all
  using (bucket_id = 'brand' and private.is_admin())
  with check (bucket_id = 'brand' and private.is_admin());

drop policy if exists "avatars owner write" on storage.objects;
create policy "avatars owner write"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) The site_settings singleton row. The app UPDATEs this row, so it must exist
--    or settings changes affect 0 rows and silently don't persist.
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

-- 5) The Privacy Policy "system page". Seeded enabled and in the footer with the
-- canonical default copy. {{site_name}}/{{contact_email}} tokens fill from
-- settings at render time (see src/lib/page-tokens.ts). It's a normal editable
-- page afterward, but protected from deletion in the app (PAGE_DEFAULTS). Idempotent.
insert into public.pages (slug, title, body_md, body_html, enabled, show_in_footer, seo_description)
select
  'privacy',
  'Privacy Policy',
  $privacy_md$_Last updated: June 18, 2026_

This policy explains what information {{site_name}} collects, why, and the choices you have. {{site_name}} is a personal blog, and we aim to collect as little as possible. We don’t sell your data or use it for advertising.

## Information we collect

**Account information.** If you create an account to comment, we store the email address and password you provide (passwords are handled by our authentication provider and stored only in hashed form) and the username (display name) you choose, which is shown publicly next to your comments.

**Comments.** The content of comments you post, along with your username and the time submitted, is stored and displayed publicly.

**Newsletter.** If you subscribe, we email you a confirmation link and only add you to the list once you confirm (double opt-in). Your email is then stored with our email provider so we can send new-post updates. You can unsubscribe at any time using the link in any email. Unconfirmed sign-ups are discarded.

**Likes and saved posts.** When you’re signed in, we record which posts you like and which you save to read later, so we can show like counts and your personal reading list. Like counts are public, but who liked or saved a post is not shown publicly; your saved list is private to your account.

**Author profiles.** If you’re given a contributor (author) role, the username you choose is shown publicly as the byline on posts you write and on a public page that lists your posts.

**Contact form.** If you send a message through our contact form, we store your name, email address, and message so we can read and respond to it, and we email a copy to the site owner (with your email as the reply-to address). We use this only to reply to you.

**Usage analytics.** We collect privacy-friendly, aggregate analytics to understand what’s popular. This includes anonymous page-view statistics (no cookies, no cross-site tracking) and a small set of anonymous events such as newsletter sign-ups, shares, and search terms. These events are not linked to your identity.

## How we use information

We use this information to operate the site: to publish and display your comments, likes, and saved-for-later list, manage your account, send the newsletter you asked for, keep the site secure (spam prevention and moderation), and understand aggregate usage so we can improve the content.

## Cookies and local storage

We use a small number of strictly necessary cookies to keep you signed in when you have an account. Your light/dark theme preference is stored in your browser’s local storage and never leaves your device. Our page-view analytics do not use cookies.

## Who we share information with

We don’t sell or rent your information. We rely on a few trusted service providers (“sub-processors”) to run the site, and your data is processed by them only to provide these services:

- **Supabase** — database, account authentication, and file storage.
- **Cloudflare** — website hosting and privacy-first, cookieless web analytics.
- **Resend** — sending account and newsletter emails.

## Data retention

We keep your information for as long as your account or subscription is active, or as needed to operate the site. Comments remain until you ask us to remove them or your account is deleted. You can unsubscribe from the newsletter at any time, which removes your email from our mailing list. Contact-form messages are kept while we follow up and are deleted once they’re no longer needed.

## Exporting and deleting your data

**Export.** From your account page you can download a copy of your data at any time — your profile, comments, likes, and saved posts — as a single file.

**Deletion.** Your account page also lets you permanently delete your account yourself. After you confirm your password, we irreversibly remove your profile and username, your comments (and any replies left on them), your likes, and your saved posts, and we delete your email address from our email provider (Resend). If you contributed posts as an author, those posts remain published but are no longer attributed to you. This action cannot be undone, and we keep no copy. If you’d prefer, you can also ask us to do this for you by contacting us.

## Your choices and rights

You can edit your username, download your data, and delete your account from your account page, and unsubscribe from the newsletter using any email’s link. You can also contact us to remove specific comments or for help with any of the above. Depending on where you live, you may have additional rights over your personal data; contact us and we’ll do our best to help.

## Children

This site isn’t directed at children under 13, and we don’t knowingly collect personal information from them.

## Changes to this policy

We may update this policy as the site evolves — for example, when we add a feature that handles data differently. When we do, we’ll revise the “Last updated” date above. Significant changes may be noted on the site.

## Contact

Questions about this policy or your data? Email [{{contact_email}}](mailto:{{contact_email}}).$privacy_md$,
  $privacy_html$<p><em>Last updated: June 18, 2026</em></p>
<p>This policy explains what information {{site_name}} collects, why, and the choices you have. {{site_name}} is a personal blog, and we aim to collect as little as possible. We don’t sell your data or use it for advertising.</p>
<h2>Information we collect</h2>
<p><strong>Account information.</strong> If you create an account to comment, we store the email address and password you provide (passwords are handled by our authentication provider and stored only in hashed form) and the username (display name) you choose, which is shown publicly next to your comments.</p>
<p><strong>Comments.</strong> The content of comments you post, along with your username and the time submitted, is stored and displayed publicly.</p>
<p><strong>Newsletter.</strong> If you subscribe, we email you a confirmation link and only add you to the list once you confirm (double opt-in). Your email is then stored with our email provider so we can send new-post updates. You can unsubscribe at any time using the link in any email. Unconfirmed sign-ups are discarded.</p>
<p><strong>Likes and saved posts.</strong> When you’re signed in, we record which posts you like and which you save to read later, so we can show like counts and your personal reading list. Like counts are public, but who liked or saved a post is not shown publicly; your saved list is private to your account.</p>
<p><strong>Author profiles.</strong> If you’re given a contributor (author) role, the username you choose is shown publicly as the byline on posts you write and on a public page that lists your posts.</p>
<p><strong>Contact form.</strong> If you send a message through our contact form, we store your name, email address, and message so we can read and respond to it, and we email a copy to the site owner (with your email as the reply-to address). We use this only to reply to you.</p>
<p><strong>Usage analytics.</strong> We collect privacy-friendly, aggregate analytics to understand what’s popular. This includes anonymous page-view statistics (no cookies, no cross-site tracking) and a small set of anonymous events such as newsletter sign-ups, shares, and search terms. These events are not linked to your identity.</p>
<h2>How we use information</h2>
<p>We use this information to operate the site: to publish and display your comments, likes, and saved-for-later list, manage your account, send the newsletter you asked for, keep the site secure (spam prevention and moderation), and understand aggregate usage so we can improve the content.</p>
<h2>Cookies and local storage</h2>
<p>We use a small number of strictly necessary cookies to keep you signed in when you have an account. Your light/dark theme preference is stored in your browser’s local storage and never leaves your device. Our page-view analytics do not use cookies.</p>
<h2>Who we share information with</h2>
<p>We don’t sell or rent your information. We rely on a few trusted service providers (“sub-processors”) to run the site, and your data is processed by them only to provide these services:</p>
<ul>
<li><strong>Supabase</strong> — database, account authentication, and file storage.</li>
<li><strong>Cloudflare</strong> — website hosting and privacy-first, cookieless web analytics.</li>
<li><strong>Resend</strong> — sending account and newsletter emails.</li>
</ul>
<h2>Data retention</h2>
<p>We keep your information for as long as your account or subscription is active, or as needed to operate the site. Comments remain until you ask us to remove them or your account is deleted. You can unsubscribe from the newsletter at any time, which removes your email from our mailing list. Contact-form messages are kept while we follow up and are deleted once they’re no longer needed.</p>
<h2>Exporting and deleting your data</h2>
<p><strong>Export.</strong> From your account page you can download a copy of your data at any time — your profile, comments, likes, and saved posts — as a single file.</p>
<p><strong>Deletion.</strong> Your account page also lets you permanently delete your account yourself. After you confirm your password, we irreversibly remove your profile and username, your comments (and any replies left on them), your likes, and your saved posts, and we delete your email address from our email provider (Resend). If you contributed posts as an author, those posts remain published but are no longer attributed to you. This action cannot be undone, and we keep no copy. If you’d prefer, you can also ask us to do this for you by contacting us.</p>
<h2>Your choices and rights</h2>
<p>You can edit your username, download your data, and delete your account from your account page, and unsubscribe from the newsletter using any email’s link. You can also contact us to remove specific comments or for help with any of the above. Depending on where you live, you may have additional rights over your personal data; contact us and we’ll do our best to help.</p>
<h2>Children</h2>
<p>This site isn’t directed at children under 13, and we don’t knowingly collect personal information from them.</p>
<h2>Changes to this policy</h2>
<p>We may update this policy as the site evolves — for example, when we add a feature that handles data differently. When we do, we’ll revise the “Last updated” date above. Significant changes may be noted on the site.</p>
<h2>Contact</h2>
<p>Questions about this policy or your data? Email <a href="mailto:%7B%7Bcontact_email%7D%7D">{{contact_email}}</a>.</p>$privacy_html$,
  true,
  true,
  'How {{site_name}} collects, uses, and protects your information.'
where not exists (
  select 1 from public.pages where lower(slug) = 'privacy'
);
