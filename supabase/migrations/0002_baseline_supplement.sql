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
