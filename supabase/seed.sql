-- ===========================================================================
-- Seed: grant yourself admin + a few starter categories.
--
-- IMPORTANT: you must SIGN IN ONCE first (so your profile row is created by the
-- on_auth_user_created trigger). Then replace the email below with YOUR
-- ADMIN_EMAIL and run this in the Supabase SQL editor.
-- ===========================================================================

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'your_email@example.com'
);

-- Optional starter categories (safe to edit/remove).
insert into public.categories (name, slug) values
  ('General', 'general'),
  ('Tech',    'tech'),
  ('Personal','personal')
on conflict (name) do nothing;

-- Verify:
-- select email, role from auth.users
--   join public.profiles on profiles.id = users.id;
