// Built-in default copy for "system" CMS pages: seeded on install and restorable
// from the page editor's "Reset to default". Keyed by page slug. The copy uses
// {{site_name}} / {{contact_email}} tokens (see page-tokens.ts), substituted from
// live settings at render time.
//
// IMPORTANT: the same markdown is also seeded as body_md in
// supabase/migrations/0002_baseline_supplement.sql. If you change the canonical
// copy here, update that seed too (and re-render its body_html).

const PRIVACY_DEFAULT_MD = `_Last updated: June 18, 2026_

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

Questions about this policy or your data? Email [{{contact_email}}](mailto:{{contact_email}}).`;

// Slugs that have a built-in default (these are "system pages": seeded, editable,
// enable/disable-able, and protected from deletion).
export const PAGE_DEFAULTS: Record<string, string> = {
  privacy: PRIVACY_DEFAULT_MD,
};
