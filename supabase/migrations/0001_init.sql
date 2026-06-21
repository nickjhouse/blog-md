SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

CREATE SCHEMA IF NOT EXISTS "private";

ALTER SCHEMA "private" OWNER TO "postgres";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."comment_status" AS ENUM (
    'visible',
    'hidden',
    'pending'
);

ALTER TYPE "public"."comment_status" OWNER TO "postgres";

CREATE TYPE "public"."post_status" AS ENUM (
    'draft',
    'published'
);

ALTER TYPE "public"."post_status" OWNER TO "postgres";

CREATE TYPE "public"."term_kind" AS ENUM (
    'allow',
    'block'
);

ALTER TYPE "public"."term_kind" OWNER TO "postgres";

CREATE TYPE "public"."user_role" AS ENUM (
    'reader',
    'author',
    'admin'
);

ALTER TYPE "public"."user_role" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

ALTER FUNCTION "private"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_author"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('author', 'admin')
  );
$$;

ALTER FUNCTION "private"."is_author"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_blocked"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_blocked
  );
$$;

ALTER FUNCTION "private"."is_blocked"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "private"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."active_categories"() RETURNS TABLE("id" "uuid", "name" "text", "slug" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select c.id, c.name, c.slug
  from public.categories c
  where exists (
    select 1 from public.posts p
    where p.category_id = c.id
      and p.status = 'published'
      and p.published_at <= now()
  )
  order by c.name;
$$;

ALTER FUNCTION "public"."active_categories"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."active_tags"() RETURNS TABLE("id" "uuid", "name" "text", "slug" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select t.id, t.name, t.slug
  from public.tags t
  where exists (
    select 1 from public.post_tags pt
    join public.posts p on p.id = pt.post_id
    where pt.tag_id = t.id
      and p.status = 'published'
      and p.published_at <= now()
  )
  order by t.name;
$$;

ALTER FUNCTION "public"."active_tags"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."analytics_summary"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with ev as (
    select name, path, props, created_at
    from public.analytics_events
    where created_at >= now() - make_interval(days => p_days)
  )
  select jsonb_build_object(
    'total', (select count(*) from ev),
    'byName', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc)
      from (select name, count(*)::int c from ev group by name) x), '[]'::jsonb),
    'shareByNetwork', coalesce((
      select jsonb_agg(jsonb_build_object('network', net, 'count', c) order by c desc)
      from (select coalesce(props->>'network', 'unknown') net, count(*)::int c
            from ev where name = 'share' group by 1) x), '[]'::jsonb),
    'topSearches', coalesce((
      select jsonb_agg(jsonb_build_object('query', q, 'count', c) order by c desc)
      from (select props->>'query' q, count(*)::int c
            from ev where name = 'search' and props->>'query' is not null
            group by 1 order by c desc limit 15) x), '[]'::jsonb),
    'zeroResultSearches', coalesce((
      select jsonb_agg(jsonb_build_object('query', q, 'count', c) order by c desc)
      from (select props->>'query' q, count(*)::int c
            from ev where name = 'search' and props->>'query' is not null
              and props->>'results' = '0'
            group by 1 order by c desc limit 15) x), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'path', path, 'created_at', created_at) order by created_at desc)
      from (select name, path, created_at from ev order by created_at desc limit 50) x), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."analytics_summary"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."category_counts"() RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "total" integer, "published" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.id, c.name, c.slug,
    count(p.id)::int as total,
    count(p.id) filter (
      where p.status = 'published' and p.published_at <= now()
    )::int as published
  from public.categories c
  left join public.posts p on p.category_id = c.id
  group by c.id, c.name, c.slug
  order by c.name;
$$;

ALTER FUNCTION "public"."category_counts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."published_series"() RETURNS TABLE("id" "uuid", "title" "text", "slug" "text", "description" "text", "published" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select s.id, s.title, s.slug, s.description,
    count(p.id) filter (
      where p.status = 'published' and p.published_at <= now()
    )::int as published
  from public.series s
  left join public.posts p on p.series_id = s.id
  group by s.id, s.title, s.slug, s.description
  having count(p.id) filter (
    where p.status = 'published' and p.published_at <= now()
  ) > 0
  order by s.title;
$$;

ALTER FUNCTION "public"."published_series"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."record_error_alert"("p_fingerprint" "text") RETURNS TABLE("occurrences" integer, "first_seen" timestamp with time zone, "last_emailed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.error_alerts (fingerprint, occurrences)
  values (p_fingerprint, 1)
  on conflict (fingerprint) do update
    set occurrences = public.error_alerts.occurrences + 1,
        last_seen = now();
  return query
    select e.occurrences, e.first_seen, e.last_emailed_at
    from public.error_alerts e
    where e.fingerprint = p_fingerprint;
end;
$$;

ALTER FUNCTION "public"."record_error_alert"("p_fingerprint" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."series_counts"() RETURNS TABLE("id" "uuid", "title" "text", "slug" "text", "description" "text", "total" integer, "published" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select s.id, s.title, s.slug, s.description,
    count(p.id)::int as total,
    count(p.id) filter (
      where p.status = 'published' and p.published_at <= now()
    )::int as published
  from public.series s
  left join public.posts p on p.series_id = s.id
  group by s.id, s.title, s.slug, s.description
  order by s.title;
$$;

ALTER FUNCTION "public"."series_counts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."tag_counts"() RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "total" integer, "published" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select t.id, t.name, t.slug,
    count(pt.post_id)::int as total,
    count(pt.post_id) filter (
      where p.status = 'published' and p.published_at <= now()
    )::int as published
  from public.tags t
  left join public.post_tags pt on pt.tag_id = t.id
  left join public.posts p on p.id = pt.post_id
  group by t.id, t.name, t.slug
  order by t.name;
$$;

ALTER FUNCTION "public"."tag_counts"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "path" "text",
    "props" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."analytics_events" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."bookmarks" (
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."bookmarks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."comment_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."comment_reports" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "status" "public"."comment_status" DEFAULT 'visible'::"public"."comment_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid",
    "edited_at" timestamp with time zone,
    CONSTRAINT "comments_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 5000)))
);

ALTER TABLE "public"."comments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "email_sent" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_messages_body_len" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 5000))),
    CONSTRAINT "contact_messages_email_len" CHECK ((("char_length"("email") >= 3) AND ("char_length"("email") <= 254))),
    CONSTRAINT "contact_messages_name_len" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "contact_messages_subject_len" CHECK ((("subject" IS NULL) OR ("char_length"("subject") <= 200)))
);

ALTER TABLE "public"."contact_messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."error_alerts" (
    "fingerprint" "text" NOT NULL,
    "occurrences" integer DEFAULT 0 NOT NULL,
    "first_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_emailed_at" timestamp with time zone
);

ALTER TABLE "public"."error_alerts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media" (
    "path" "text" NOT NULL,
    "size_bytes" bigint,
    "content_type" "text",
    "width" integer,
    "height" integer,
    "alt" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."media" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."moderation_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term" "text" NOT NULL,
    "kind" "public"."term_kind" DEFAULT 'block'::"public"."term_kind" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."moderation_terms" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."newsletter_confirmations" (
    "token" "text" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);

ALTER TABLE "public"."newsletter_confirmations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body_md" "text" DEFAULT ''::"text" NOT NULL,
    "body_html" "text" DEFAULT ''::"text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "show_in_footer" boolean DEFAULT false NOT NULL,
    "seo_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pages_seo_desc_len" CHECK ((("seo_description" IS NULL) OR ("char_length"("seo_description") <= 300))),
    CONSTRAINT "pages_title_len" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200)))
);

ALTER TABLE "public"."pages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."post_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "edited_by" "uuid",
    "title" "text",
    "slug" "text",
    "body_md" "text",
    "excerpt" "text",
    "category_id" "uuid",
    "cover_image" "text",
    "cover_alt" "text",
    "status" "public"."post_status",
    "published_at" timestamp with time zone,
    "series_id" "uuid",
    "series_order" integer,
    "seo_title" "text",
    "seo_description" "text",
    "canonical_url" "text",
    "og_image" "text",
    "noindex" boolean DEFAULT false NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."post_revisions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."post_tags" (
    "post_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);

ALTER TABLE "public"."post_tags" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category_id" "uuid",
    "excerpt" "text",
    "body_md" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "cover_image" "text",
    "status" "public"."post_status" DEFAULT 'draft'::"public"."post_status" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reading_minutes" integer,
    "cover_alt" "text",
    "search_tsv" "tsvector" GENERATED ALWAYS AS ((("setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("title", ''::"text")), 'A'::"char") || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("excerpt", ''::"text")), 'B'::"char")) || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("body_md", ''::"text")), 'C'::"char"))) STORED,
    "newsletter_sent_at" timestamp with time zone,
    "series_id" "uuid",
    "series_order" integer,
    "author_id" "uuid",
    "seo_title" "text",
    "seo_description" "text",
    "canonical_url" "text",
    "og_image" "text",
    "noindex" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."posts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "is_blocked" boolean DEFAULT false NOT NULL,
    "blocked_at" timestamp with time zone,
    "blocked_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notify_on_reply" boolean DEFAULT true NOT NULL,
    "role" "public"."user_role" DEFAULT 'reader'::"public"."user_role" NOT NULL,
    "bio" "text",
    "website_url" "text",
    "x_url" "text",
    "github_url" "text",
    "bluesky_url" "text",
    "mastodon_url" "text",
    "linkedin_url" "text",
    "full_name" "text",
    CONSTRAINT "profiles_bio_len" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 280))),
    CONSTRAINT "profiles_bluesky_url_ck" CHECK ((("bluesky_url" IS NULL) OR (("char_length"("bluesky_url") <= 500) AND ("bluesky_url" ~* '^https?://'::"text")))),
    CONSTRAINT "profiles_full_name_len" CHECK ((("full_name" IS NULL) OR ("char_length"("full_name") <= 80))),
    CONSTRAINT "profiles_github_url_ck" CHECK ((("github_url" IS NULL) OR (("char_length"("github_url") <= 500) AND ("github_url" ~* '^https?://'::"text")))),
    CONSTRAINT "profiles_linkedin_url_ck" CHECK ((("linkedin_url" IS NULL) OR (("char_length"("linkedin_url") <= 500) AND ("linkedin_url" ~* '^https?://'::"text")))),
    CONSTRAINT "profiles_mastodon_url_ck" CHECK ((("mastodon_url" IS NULL) OR (("char_length"("mastodon_url") <= 500) AND ("mastodon_url" ~* '^https?://'::"text")))),
    CONSTRAINT "profiles_website_url_ck" CHECK ((("website_url" IS NULL) OR (("char_length"("website_url") <= 500) AND ("website_url" ~* '^https?://'::"text")))),
    CONSTRAINT "profiles_x_url_ck" CHECK ((("x_url" IS NULL) OR (("char_length"("x_url") <= 500) AND ("x_url" ~* '^https?://'::"text"))))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."reactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."series" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "require_comment_approval" boolean DEFAULT false NOT NULL,
    "notify_on_comment" boolean DEFAULT true NOT NULL,
    "rate_limit_seconds" integer DEFAULT 15 NOT NULL,
    "max_links_per_comment" integer DEFAULT 3 NOT NULL,
    "brand_icon_path" "text",
    "brand_icon_version" integer DEFAULT 0 NOT NULL,
    "site_name" "text",
    "site_description" "text",
    "contact_email" "text",
    "site_locale" "text",
    "theme_overrides" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "auto_newsletter_on_publish" boolean DEFAULT false NOT NULL,
    "auto_newsletter_include_authors" boolean DEFAULT false NOT NULL,
    "home_intro" "text",
    "home_intro_enabled" boolean DEFAULT true NOT NULL,
    "bulk_publish_sends_newsletter" boolean DEFAULT false NOT NULL,
    "newsletter_prompt_trigger" "text" DEFAULT 'off'::"text" NOT NULL,
    "newsletter_prompt_scroll_pct" integer DEFAULT 50 NOT NULL,
    "newsletter_prompt_delay_seconds" integer DEFAULT 30 NOT NULL,
    "newsletter_prompt_redisplay_days" integer DEFAULT 30 NOT NULL,
    "contact_enabled" boolean DEFAULT true NOT NULL,
    "theme_default" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "site_settings_nl_prompt_delay_ck" CHECK ((("newsletter_prompt_delay_seconds" >= 0) AND ("newsletter_prompt_delay_seconds" <= 3600))),
    CONSTRAINT "site_settings_nl_prompt_redisplay_ck" CHECK ((("newsletter_prompt_redisplay_days" >= 0) AND ("newsletter_prompt_redisplay_days" <= 365))),
    CONSTRAINT "site_settings_nl_prompt_scroll_ck" CHECK ((("newsletter_prompt_scroll_pct" >= 1) AND ("newsletter_prompt_scroll_pct" <= 100))),
    CONSTRAINT "site_settings_nl_prompt_trigger_ck" CHECK (("newsletter_prompt_trigger" = ANY (ARRAY['off'::"text", 'scroll'::"text", 'time'::"text", 'exit'::"text"]))),
    CONSTRAINT "site_settings_singleton" CHECK ("id")
);

ALTER TABLE "public"."site_settings" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."tags" OWNER TO "postgres";

ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("user_id", "post_id");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."comment_reports"
    ADD CONSTRAINT "comment_reports_comment_id_reporter_id_key" UNIQUE ("comment_id", "reporter_id");

ALTER TABLE ONLY "public"."comment_reports"
    ADD CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."error_alerts"
    ADD CONSTRAINT "error_alerts_pkey" PRIMARY KEY ("fingerprint");

ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("path");

ALTER TABLE ONLY "public"."moderation_terms"
    ADD CONSTRAINT "moderation_terms_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."moderation_terms"
    ADD CONSTRAINT "moderation_terms_term_kind_key" UNIQUE ("term", "kind");

ALTER TABLE ONLY "public"."newsletter_confirmations"
    ADD CONSTRAINT "newsletter_confirmations_pkey" PRIMARY KEY ("token");

ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."post_revisions"
    ADD CONSTRAINT "post_revisions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_pkey" PRIMARY KEY ("post_id", "tag_id");

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("post_id", "user_id");

ALTER TABLE ONLY "public"."series"
    ADD CONSTRAINT "series_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."series"
    ADD CONSTRAINT "series_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");

CREATE INDEX "analytics_events_name_created_idx" ON "public"."analytics_events" USING "btree" ("name", "created_at" DESC);

CREATE INDEX "bookmarks_user_idx" ON "public"."bookmarks" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "comment_reports_comment_idx" ON "public"."comment_reports" USING "btree" ("comment_id");

CREATE INDEX "comments_parent_idx" ON "public"."comments" USING "btree" ("parent_id");

CREATE INDEX "comments_post_idx" ON "public"."comments" USING "btree" ("post_id", "created_at" DESC);

CREATE INDEX "contact_messages_created_idx" ON "public"."contact_messages" USING "btree" ("created_at" DESC);

CREATE INDEX "error_alerts_last_emailed_idx" ON "public"."error_alerts" USING "btree" ("last_emailed_at");

CREATE INDEX "media_created_idx" ON "public"."media" USING "btree" ("created_at" DESC);

CREATE INDEX "newsletter_confirmations_email_idx" ON "public"."newsletter_confirmations" USING "btree" ("email");

CREATE INDEX "pages_enabled_idx" ON "public"."pages" USING "btree" ("enabled");

CREATE UNIQUE INDEX "pages_slug_unique" ON "public"."pages" USING "btree" ("lower"("slug"));

CREATE INDEX "post_revisions_post_created_idx" ON "public"."post_revisions" USING "btree" ("post_id", "created_at" DESC);

CREATE INDEX "post_tags_tag_idx" ON "public"."post_tags" USING "btree" ("tag_id");

CREATE INDEX "posts_author_idx" ON "public"."posts" USING "btree" ("author_id");

CREATE INDEX "posts_category_idx" ON "public"."posts" USING "btree" ("category_id");

CREATE INDEX "posts_search_tsv_idx" ON "public"."posts" USING "gin" ("search_tsv");

CREATE INDEX "posts_series_idx" ON "public"."posts" USING "btree" ("series_id", "series_order");

CREATE INDEX "posts_status_published_at_idx" ON "public"."posts" USING "btree" ("status", "published_at" DESC);

CREATE UNIQUE INDEX "profiles_username_unique" ON "public"."profiles" USING "btree" ("lower"("display_name")) WHERE ("display_name" IS NOT NULL);

CREATE INDEX "reactions_post_idx" ON "public"."reactions" USING "btree" ("post_id");

CREATE OR REPLACE TRIGGER "posts_set_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comment_reports"
    ADD CONSTRAINT "comment_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comment_reports"
    ADD CONSTRAINT "comment_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."post_revisions"
    ADD CONSTRAINT "post_revisions_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."post_revisions"
    ADD CONSTRAINT "post_revisions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

CREATE POLICY "admins manage all posts" ON "public"."posts" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());

ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "author or admin deletes comment" ON "public"."comments" FOR DELETE USING ((("auth"."uid"() = "author_id") OR "private"."is_admin"()));

CREATE POLICY "author or admin updates comment" ON "public"."comments" FOR UPDATE USING ((("auth"."uid"() = "author_id") OR "private"."is_admin"())) WITH CHECK ((("auth"."uid"() = "author_id") OR "private"."is_admin"()));

CREATE POLICY "authors manage own posts" ON "public"."posts" USING (("private"."is_author"() AND ("author_id" = "auth"."uid"()))) WITH CHECK (("private"."is_author"() AND ("author_id" = "auth"."uid"())));

ALTER TABLE "public"."bookmarks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories readable by everyone" ON "public"."categories" FOR SELECT USING (true);

ALTER TABLE "public"."comment_reports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enabled pages readable by everyone" ON "public"."pages" FOR SELECT USING (("enabled" OR "private"."is_admin"()));

ALTER TABLE "public"."error_alerts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logged-in non-blocked users insert comments" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "author_id") AND (NOT "private"."is_blocked"())));

ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."moderation_terms" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."newsletter_confirmations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client access (service-role only)" ON "public"."analytics_events" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."bookmarks" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."comment_reports" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."contact_messages" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."error_alerts" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."media" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."moderation_terms" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."newsletter_confirmations" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."post_revisions" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."reactions" USING (false) WITH CHECK (false);

CREATE POLICY "no client access (service-role only)" ON "public"."site_settings" USING (false) WITH CHECK (false);

CREATE POLICY "only admin writes categories" ON "public"."categories" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());

ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."post_revisions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."post_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_tags readable by everyone" ON "public"."post_tags" FOR SELECT USING (true);

ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles are readable by everyone" ON "public"."profiles" FOR SELECT USING (true);

CREATE POLICY "published posts readable by everyone" ON "public"."posts" FOR SELECT USING (((("status" = 'published'::"public"."post_status") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"())) OR "private"."is_admin"()));

ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."series" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "series readable by everyone" ON "public"."series" FOR SELECT USING (true);

ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags readable by everyone" ON "public"."tags" FOR SELECT USING (true);

CREATE POLICY "users update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "visible comments readable by everyone" ON "public"."comments" FOR SELECT USING ((("status" = 'visible'::"public"."comment_status") OR "private"."is_admin"() OR (("status" = 'pending'::"public"."comment_status") AND ("author_id" = "auth"."uid"()))));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "private" TO PUBLIC;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."active_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."active_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."active_categories"() TO "service_role";

GRANT ALL ON FUNCTION "public"."active_tags"() TO "anon";
GRANT ALL ON FUNCTION "public"."active_tags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."active_tags"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."analytics_summary"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."analytics_summary"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."category_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."category_counts"() TO "service_role";

GRANT ALL ON FUNCTION "public"."published_series"() TO "anon";
GRANT ALL ON FUNCTION "public"."published_series"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."published_series"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_error_alert"("p_fingerprint" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_error_alert"("p_fingerprint" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."series_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."series_counts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."tag_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tag_counts"() TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_events" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_events" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookmarks" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookmarks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookmarks" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."categories" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comment_reports" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comment_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_reports" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contact_messages" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."error_alerts" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."error_alerts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."error_alerts" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."media" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."moderation_terms" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."moderation_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_terms" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."newsletter_confirmations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."newsletter_confirmations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."newsletter_confirmations" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pages" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_revisions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_revisions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_revisions" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_tags" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."post_tags" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."posts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT UPDATE("display_name") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("notify_on_reply") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("bio") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("website_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("x_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("github_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("bluesky_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("mastodon_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("linkedin_url") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reactions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reactions" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."series" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."series" TO "authenticated";
GRANT ALL ON TABLE "public"."series" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."site_settings" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."site_settings" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."site_settings" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tags" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
