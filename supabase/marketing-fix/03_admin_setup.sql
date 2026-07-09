-- Corrected Soteria-Marketing admin setup
-- Run after corrected_marketing_migration.sql.
-- Uses auth.users IDs already in Supabase. Does not hardcode UUIDs.

insert into public.roles (name, description)
values
  ('administrator', 'Full marketing website administration access.'),
  ('editor', 'Can manage marketing website content, products, services, pricing, images, quote requests, and orders.')
on conflict (name) do update set description = excluded.description;

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  lower(u.email),
  case
    when lower(u.email) = 'josh@soteriaservices.net' then 'Joshua Chynces'
    when lower(u.email) = 'shay@soteriaservices.net' then 'Shay Taillefer'
  end as full_name,
  case
    when lower(u.email) = 'josh@soteriaservices.net' then 'administrator'
    when lower(u.email) = 'shay@soteriaservices.net' then 'editor'
  end as role
from auth.users u
where lower(u.email) in (
  'josh@soteriaservices.net',
  'shay@soteriaservices.net'
)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  updated_at = now();

insert into public.admin_profiles (user_id, profile_id, role, display_name)
select
  u.id as user_id,
  u.id as profile_id,
  case
    when lower(u.email) = 'josh@soteriaservices.net' then 'administrator'
    when lower(u.email) = 'shay@soteriaservices.net' then 'editor'
  end as role,
  case
    when lower(u.email) = 'josh@soteriaservices.net' then 'Joshua Chynces'
    when lower(u.email) = 'shay@soteriaservices.net' then 'Shay Taillefer'
  end as display_name
from auth.users u
where lower(u.email) in (
  'josh@soteriaservices.net',
  'shay@soteriaservices.net'
)
on conflict (user_id) do update
set
  profile_id = excluded.profile_id,
  role = excluded.role,
  display_name = excluded.display_name,
  updated_at = now();

select
  p.email,
  p.full_name,
  p.role as profiles_role,
  ap.role as admin_profiles_role,
  ap.display_name
from public.profiles p
left join public.admin_profiles ap on ap.user_id = p.id
where lower(p.email) in (
  'josh@soteriaservices.net',
  'shay@soteriaservices.net'
)
order by p.email;
