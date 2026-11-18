-- Soteria Services Supabase Auth roles and profiles
-- Paste this SQL into the Supabase SQL editor for the project that backs the website.

create table if not exists public.roles (
  name text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description)
values
  ('administrator', 'Full website administration access, including settings and user invitations.'),
  ('editor', 'Can edit public products, services, pricing, inventory, and content.'),
  ('Pending User', 'No access. An administrator must assign a role before this account can work in the website or Soteria Pulse.'),
  ('pending_user', 'No access. An administrator must assign a role before this account can work in the website or Soteria Pulse.'),
  ('pending', 'No access. An administrator must assign a role before this account can work in the website or Soteria Pulse.')
on conflict (name) do update set description = excluded.description;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null references public.roles(name) default 'Pending User',
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists status text not null default 'Pending';
create unique index if not exists profiles_user_id_key on public.profiles(user_id);

-- Change defaults for future inserts only. Skip a default the live check
-- constraint would reject. Do not update existing rows.
do $$
declare
  role_checks text;
  status_checks text;
begin
  if to_regclass('public.profiles') is not null then
    select string_agg(pg_get_constraintdef(con.oid), ' ')
      into role_checks
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* '\mrole\M';
    if role_checks is null or role_checks ~* 'Pending User' then
      execute 'alter table public.profiles alter column role set default ''Pending User''';
    end if;

    select string_agg(pg_get_constraintdef(con.oid), ' ')
      into status_checks
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* '\mstatus\M';
    if status_checks is null or status_checks ~* 'Pending' then
      execute 'alter table public.profiles alter column status set default ''Pending''';
    end if;
  end if;

  if to_regclass('public.admin_profiles') is not null then
    execute 'alter table public.admin_profiles add column if not exists user_id uuid references auth.users(id) on delete cascade';
    execute 'create unique index if not exists admin_profiles_user_id_key on public.admin_profiles(user_id)';
    execute 'alter table public.admin_profiles add column if not exists status text not null default ''pending''';

    select string_agg(pg_get_constraintdef(con.oid), ' ')
      into role_checks
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'admin_profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* '\mrole\M';
    if role_checks is null or role_checks ~* 'pending' then
      execute 'alter table public.admin_profiles alter column role set default ''pending''';
    end if;

    select string_agg(pg_get_constraintdef(con.oid), ' ')
      into status_checks
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'admin_profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* '\mstatus\M';
    if status_checks is null or status_checks ~* 'pending' then
      execute 'alter table public.admin_profiles alter column status set default ''pending''';
    end if;
  end if;
end $$;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_email_idx on public.profiles(lower(email));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'administrator', false);
$$;

-- handle_new_user and on_auth_user_created live in the shared Pulse script
-- supabase_pending_signup_fix.sql (soteria-pulse PR #3). That function
-- creates role 'Pending User' and status 'Pending', never reads
-- raw_user_meta_data.role, and does not overwrite role on conflict.
-- Do not recreate the function or trigger here. Re-running this file must
-- not put the old metadata-role trigger back.

alter table public.roles enable row level security;
alter table public.profiles enable row level security;

-- Idempotently replace policies so rerunning this migration is safe.
drop policy if exists "Authenticated users can read roles" on public.roles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Administrators can read all profiles" on public.profiles;
drop policy if exists "Users can update own basic profile" on public.profiles;
drop policy if exists "Administrators can manage profiles" on public.profiles;

create policy "Authenticated users can read roles"
on public.roles
for select
to authenticated
using (true);

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Administrators can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- "Users can update own basic profile" is dropped above and must not be
-- recreated. It let a signed-in user update their own row without locking
-- status. Pulse keeps a restrictive policy that only an administrator can
-- change role or status.

create policy "Administrators can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- First admin setup after creating Joshua in Supabase Authentication:
-- update public.profiles
-- set full_name = 'Joshua Chynces', role = 'administrator'
-- where lower(email) = lower('JOSHUA_EMAIL_HERE');
--
-- Shay editor setup after creating or inviting Shay:
-- update public.profiles
-- set full_name = 'Shay Taillefer', role = 'editor'
-- where lower(email) = lower('SHAY_EMAIL_HERE');
