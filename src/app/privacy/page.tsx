import type { Metadata } from "next";
import { getSiteIdentity } from "@/lib/identity";

// Bump this whenever the policy changes (e.g. when a new data-touching feature
// ships). The contact address is editable at /admin/settings/identity.
const LAST_UPDATED = "June 18, 2026";

// Stays dynamic for now (Option C: post pages are cached first) so the live site
// name / contact address are always current.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteIdentity();
  return {
    title: "Privacy Policy",
    description: `How ${name} collects, uses, and protects your information.`,
    alternates: { canonical: "/privacy" },
  };
}

export default async function PrivacyPage() {
  const { name: siteName, contactEmail } = await getSiteIdentity();
  return (
    <article className="prose-content">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Privacy Policy
      </h1>
      <p className="text-sm text-[color:var(--muted)]">
        Last updated: {LAST_UPDATED}
      </p>

      <p>
        This policy explains what information {siteName} collects, why, and the
        choices you have. {siteName} is a personal blog, and we aim to collect
        as little as possible. We don’t sell your data or use it for advertising.
      </p>

      <h2>Information we collect</h2>
      <p>
        <strong>Account information.</strong> If you create an account to
        comment, we store the email address and password you provide (passwords
        are handled by our authentication provider and stored only in hashed
        form) and the username (display name) you choose, which is shown publicly
        next to your comments.
      </p>
      <p>
        <strong>Comments.</strong> The content of comments you post, along with
        your username and the time submitted, is stored and displayed publicly.
      </p>
      <p>
        <strong>Newsletter.</strong> If you subscribe, we email you a
        confirmation link and only add you to the list once you confirm
        (double opt-in). Your email is then stored with our email provider so we
        can send new-post updates. You can unsubscribe at any time using the link
        in any email. Unconfirmed sign-ups are discarded.
      </p>
      <p>
        <strong>Likes and saved posts.</strong> When you’re signed in, we record
        which posts you like and which you save to read later, so we can show
        like counts and your personal reading list. Like counts are public, but
        who liked or saved a post is not shown publicly; your saved list is
        private to your account.
      </p>
      <p>
        <strong>Author profiles.</strong> If you’re given a contributor (author)
        role, the username you choose is shown publicly as the byline on posts
        you write and on a public page that lists your posts.
      </p>
      <p>
        <strong>Contact form.</strong> If you send a message through our contact
        form, we store your name, email address, and message so we can read and
        respond to it, and we email a copy to the site owner (with your email as
        the reply-to address). We use this only to reply to you.
      </p>
      <p>
        <strong>Usage analytics.</strong> We collect privacy-friendly, aggregate
        analytics to understand what’s popular. This includes anonymous page-view
        statistics (no cookies, no cross-site tracking) and a small set of
        anonymous events such as newsletter sign-ups, shares, and search terms.
        These events are not linked to your identity.
      </p>

      <h2>How we use information</h2>
      <p>
        We use this information to operate the site: to publish and display your
        comments, likes, and saved-for-later list, manage your account, send the
        newsletter you asked for, keep the site secure (spam prevention and
        moderation), and understand aggregate usage so we can improve the content.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We use a small number of strictly necessary cookies to keep you signed in
        when you have an account. Your light/dark theme preference is stored in
        your browser’s local storage and never leaves your device. Our page-view
        analytics do not use cookies.
      </p>

      <h2>Who we share information with</h2>
      <p>
        We don’t sell or rent your information. We rely on a few trusted service
        providers (“sub-processors”) to run the site, and your data is processed
        by them only to provide these services:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, account authentication, and file
          storage.
        </li>
        <li>
          <strong>Cloudflare</strong> — website hosting and privacy-first,
          cookieless web analytics.
        </li>
        <li>
          <strong>Resend</strong> — sending account and newsletter emails.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep your information for as long as your account or subscription is
        active, or as needed to operate the site. Comments remain until you ask
        us to remove them or your account is deleted. You can unsubscribe from the
        newsletter at any time, which removes your email from our mailing list.
        Contact-form messages are kept while we follow up and are deleted once
        they’re no longer needed.
      </p>

      <h2>Exporting and deleting your data</h2>
      <p>
        <strong>Export.</strong> From your account page you can download a copy of
        your data at any time — your profile, comments, likes, and saved posts —
        as a single file.
      </p>
      <p>
        <strong>Deletion.</strong> Your account page also lets you permanently
        delete your account yourself. After you confirm your password, we
        irreversibly remove your profile and username, your comments (and any
        replies left on them), your likes, and your saved posts, and we delete
        your email address from our email provider (Resend). If you contributed
        posts as an author, those posts remain published but are no longer
        attributed to you. This action cannot be undone, and we keep no copy. If
        you’d prefer, you can also ask us to do this for you by contacting us.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can edit your username, download your data, and delete your account
        from your account page, and unsubscribe from the newsletter using any
        email’s link. You can also contact us to remove specific comments or for
        help with any of the above. Depending on where you live, you may have
        additional rights over your personal data; contact us and we’ll do our
        best to help.
      </p>

      <h2>Children</h2>
      <p>
        This site isn’t directed at children under 13, and we don’t knowingly
        collect personal information from them.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as the site evolves — for example, when we add
        a feature that handles data differently. When we do, we’ll revise the
        “Last updated” date above. Significant changes may be noted on the site.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </article>
  );
}
