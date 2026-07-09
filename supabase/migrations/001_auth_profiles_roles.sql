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
  ('editor', 'Can edit public products, services, pricing, inventory, and content.')
on conflict (name) do update set description = excluded.description;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null references public.roles(name) default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' in ('administrator', 'editor') then new.raw_user_meta_data->>'role'
      else 'editor'
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

create policy "Users can update own basic profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_user_role());

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
