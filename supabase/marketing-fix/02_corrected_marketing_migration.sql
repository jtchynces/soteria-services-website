-- Corrected Soteria-Marketing-only migration
-- Purpose: repair/normalize the marketing/e-commerce website database only.
-- Does not use Soteria Pulse tables or columns.
-- Safe for partial/legacy marketing tables: uses create-if-missing and add-column-if-missing.

create extension if not exists pgcrypto;

create table if not exists public.roles (
  name text primary key,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.roles add column if not exists name text;
alter table public.roles add column if not exists description text not null default '';
alter table public.roles add column if not exists created_at timestamptz not null default now();

insert into public.roles (name, description)
values
  ('administrator', 'Full marketing website administration access.'),
  ('editor', 'Can manage marketing website content, products, services, pricing, images, quote requests, and orders.')
on conflict (name) do update set description = excluded.description;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists id uuid;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists role text not null default 'editor';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles p
set id = u.id
from auth.users u
where p.id is null
  and p.email is not null
  and lower(p.email) = lower(u.email);

update public.profiles
set role = 'editor'
where role is null or role not in ('administrator', 'editor');

create unique index if not exists profiles_id_uidx on public.profiles(id) where id is not null;
create unique index if not exists profiles_email_uidx on public.profiles(lower(email)) where email is not null;
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'editor',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles add column if not exists user_id uuid;
alter table public.admin_profiles add column if not exists profile_id uuid;
alter table public.admin_profiles add column if not exists role text not null default 'editor';
alter table public.admin_profiles add column if not exists display_name text not null default '';
alter table public.admin_profiles add column if not exists created_at timestamptz not null default now();
alter table public.admin_profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists admin_profiles_user_id_uidx on public.admin_profiles(user_id) where user_id is not null;
create index if not exists admin_profiles_role_idx on public.admin_profiles(role);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists key text;
alter table public.site_settings add column if not exists value text not null default '';
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();
create unique index if not exists site_settings_key_uidx on public.site_settings(key) where key is not null;

insert into public.site_settings (key, value)
values
  ('public_site_mode', 'coming_soon'),
  ('company_name', 'Soteria Services'),
  ('company_email', 'info@soteriaservices.net'),
  ('company_phone', ''),
  ('company_logo_url', '/assets/soteria-logo.svg'),
  ('primary_cta_text', 'Request a Quote'),
  ('primary_cta_url', '/request-quote')
on conflict (key) do nothing;

create table if not exists public.products (
  id text primary key,
  category text not null default '',
  name text not null default '',
  description text not null default '',
  amount integer not null default 0,
  currency text not null default 'cad',
  tax_behavior text not null default 'confirm_manually',
  inventory_status text not null default 'available',
  image_url text not null default '/assets/soteria-logo.svg',
  mode text not null default 'request_quote',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists id text;
alter table public.products add column if not exists category text not null default '';
alter table public.products add column if not exists name text not null default '';
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists amount integer not null default 0;
alter table public.products add column if not exists currency text not null default 'cad';
alter table public.products add column if not exists tax_behavior text not null default 'confirm_manually';
alter table public.products add column if not exists inventory_status text not null default 'available';
alter table public.products add column if not exists image_url text not null default '/assets/soteria-logo.svg';
alter table public.products add column if not exists mode text not null default 'request_quote';
alter table public.products add column if not exists enabled boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

update public.products
set id = lower(regexp_replace(coalesce(nullif(name, ''), 'product') || '-' || substr(gen_random_uuid()::text, 1, 8), '[^a-z0-9]+', '-', 'g'))
where id is null or id = '';

update public.products set currency = 'cad' where currency is null or currency = '';
update public.products set tax_behavior = 'confirm_manually' where tax_behavior is null or tax_behavior not in ('taxable', 'non_taxable', 'confirm_manually');
update public.products set mode = 'request_quote' where mode is null or mode not in ('buy_now', 'request_quote', 'deposit_only', 'inquiry_only');
update public.products set image_url = '/assets/soteria-logo.svg' where image_url is null or image_url = '';

create unique index if not exists products_id_uidx on public.products(id) where id is not null;
create index if not exists products_enabled_idx on public.products(enabled);
create index if not exists products_category_idx on public.products(category);

insert into public.products (id, category, name, description, amount, currency, tax_behavior, inventory_status, image_url, mode, enabled)
values
  ('first-aid-training-seat', 'First Aid Training', 'First Aid / CPR Training Seat', 'Training registration payment for confirmed First Aid or CPR course seats.', 12500, 'cad', 'confirm_manually', 'available', '/assets/soteria-logo.svg', 'buy_now', true),
  ('aed-program-deposit', 'AED Sales', 'AED Program Deposit', 'Deposit toward an AED sales and program setup quote. Final scope is confirmed by Soteria Services.', 25000, 'cad', 'confirm_manually', 'quote_required', '/assets/soteria-logo.svg', 'deposit_only', true),
  ('workplace-first-aid-kit', 'First Aid Kits', 'Workplace First Aid Kit', 'Workplace first aid kit order. Product selection and availability are subject to confirmation.', 13900, 'cad', 'confirm_manually', 'available', '/assets/soteria-logo.svg', 'buy_now', true),
  ('mask-fit-testing-session', 'Mask Fit Testing', 'Mask Fit Testing Appointment', 'Qualitative respirator fit testing appointment or group booking deposit.', 4500, 'cad', 'confirm_manually', 'available', '/assets/soteria-logo.svg', 'buy_now', true),
  ('event-medical-deposit', 'Event Medical Deposit', 'Event Medical Coverage Deposit', 'Deposit for event first aid or medical standby coverage. Soteria will confirm event details after payment.', 30000, 'cad', 'confirm_manually', 'scheduled_service', '/assets/soteria-logo.svg', 'deposit_only', true),
  ('readiness-assessment-deposit', 'Consulting / Readiness Assessment Deposit', 'Readiness Assessment Deposit', 'Deposit for emergency preparedness consulting or readiness assessment.', 25000, 'cad', 'confirm_manually', 'scheduled_service', '/assets/soteria-logo.svg', 'deposit_only', true),
  ('soteria-pulse-discovery', 'Soteria Pulse Inquiry', 'Soteria Pulse Discovery Call', 'Request a Soteria Pulse discovery call. No payment required.', 0, 'cad', 'non_taxable', 'inquiry_only', '/assets/soteria-logo.svg', 'inquiry_only', true)
on conflict (id) do nothing;

create table if not exists public.services (
  id text primary key,
  title text not null default '',
  slug text not null default '',
  summary text not null default '',
  body text not null default '',
  image_url text not null default '/assets/soteria-logo.svg',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists id text;
alter table public.services add column if not exists title text not null default '';
alter table public.services add column if not exists slug text not null default '';
alter table public.services add column if not exists summary text not null default '';
alter table public.services add column if not exists body text not null default '';
alter table public.services add column if not exists image_url text not null default '/assets/soteria-logo.svg';
alter table public.services add column if not exists enabled boolean not null default true;
alter table public.services add column if not exists sort_order integer not null default 0;
alter table public.services add column if not exists created_at timestamptz not null default now();
alter table public.services add column if not exists updated_at timestamptz not null default now();

update public.services
set id = lower(regexp_replace(coalesce(nullif(slug, ''), nullif(title, ''), 'service') || '-' || substr(gen_random_uuid()::text, 1, 8), '[^a-z0-9]+', '-', 'g'))
where id is null or id = '';
update public.services set slug = id where slug is null or slug = '';
create unique index if not exists services_id_uidx on public.services(id) where id is not null;
create unique index if not exists services_slug_uidx on public.services(slug) where slug is not null;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  organization text not null default '',
  email text not null default '',
  phone text not null default '',
  service_interest text not null default '',
  message text not null default '',
  preferred_contact_method text not null default '',
  preferred_timeline text not null default '',
  source text not null default 'marketing_website',
  status text not null default 'New Lead',
  created_at timestamptz not null default now()
);

alter table public.quote_requests add column if not exists id uuid default gen_random_uuid();
alter table public.quote_requests add column if not exists customer_name text not null default '';
alter table public.quote_requests add column if not exists organization text not null default '';
alter table public.quote_requests add column if not exists email text not null default '';
alter table public.quote_requests add column if not exists phone text not null default '';
alter table public.quote_requests add column if not exists service_interest text not null default '';
alter table public.quote_requests add column if not exists message text not null default '';
alter table public.quote_requests add column if not exists preferred_contact_method text not null default '';
alter table public.quote_requests add column if not exists preferred_timeline text not null default '';
alter table public.quote_requests add column if not exists source text not null default 'marketing_website';
alter table public.quote_requests add column if not exists status text not null default 'New Lead';
alter table public.quote_requests add column if not exists created_at timestamptz not null default now();
update public.quote_requests set id = gen_random_uuid() where id is null;
create unique index if not exists quote_requests_id_uidx on public.quote_requests(id) where id is not null;
create index if not exists quote_requests_created_at_idx on public.quote_requests(created_at);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  organization text not null default '',
  email text not null default '',
  phone text not null default '',
  product text not null default '',
  category text not null default '',
  amount integer not null default 0,
  payment_status text not null default 'New',
  stripe_checkout_session_id text not null default '',
  stripe_payment_intent_id text not null default '',
  notes text not null default '',
  fulfillment_status text not null default 'New',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists id uuid default gen_random_uuid();
alter table public.orders add column if not exists customer_name text not null default '';
alter table public.orders add column if not exists organization text not null default '';
alter table public.orders add column if not exists email text not null default '';
alter table public.orders add column if not exists phone text not null default '';
alter table public.orders add column if not exists product text not null default '';
alter table public.orders add column if not exists category text not null default '';
alter table public.orders add column if not exists amount integer not null default 0;
alter table public.orders add column if not exists payment_status text not null default 'New';
alter table public.orders add column if not exists stripe_checkout_session_id text not null default '';
alter table public.orders add column if not exists stripe_payment_intent_id text not null default '';
alter table public.orders add column if not exists notes text not null default '';
alter table public.orders add column if not exists fulfillment_status text not null default 'New';
alter table public.orders add column if not exists created_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();
update public.orders set id = gen_random_uuid() where id is null;
create unique index if not exists orders_id_uidx on public.orders(id) where id is not null;
create index if not exists orders_created_at_idx on public.orders(created_at);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  url text not null default '',
  alt_text text not null default '',
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

alter table public.media_assets add column if not exists id uuid default gen_random_uuid();
alter table public.media_assets add column if not exists name text not null default '';
alter table public.media_assets add column if not exists url text not null default '';
alter table public.media_assets add column if not exists alt_text text not null default '';
alter table public.media_assets add column if not exists uploaded_by uuid;
alter table public.media_assets add column if not exists created_at timestamptz not null default now();
update public.media_assets set id = gen_random_uuid() where id is null;
create unique index if not exists media_assets_id_uidx on public.media_assets(id) where id is not null;

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

create or replace function public.touch_marketing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_marketing_updated_at on public.profiles;
create trigger profiles_touch_marketing_updated_at before update on public.profiles for each row execute function public.touch_marketing_updated_at();
drop trigger if exists site_settings_touch_marketing_updated_at on public.site_settings;
create trigger site_settings_touch_marketing_updated_at before update on public.site_settings for each row execute function public.touch_marketing_updated_at();
drop trigger if exists products_touch_marketing_updated_at on public.products;
create trigger products_touch_marketing_updated_at before update on public.products for each row execute function public.touch_marketing_updated_at();
drop trigger if exists services_touch_marketing_updated_at on public.services;
create trigger services_touch_marketing_updated_at before update on public.services for each row execute function public.touch_marketing_updated_at();
drop trigger if exists orders_touch_marketing_updated_at on public.orders;
create trigger orders_touch_marketing_updated_at before update on public.orders for each row execute function public.touch_marketing_updated_at();
drop trigger if exists admin_profiles_touch_marketing_updated_at on public.admin_profiles;
create trigger admin_profiles_touch_marketing_updated_at before update on public.admin_profiles for each row execute function public.touch_marketing_updated_at();

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
alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.quote_requests enable row level security;
alter table public.orders enable row level security;
alter table public.media_assets enable row level security;

drop policy if exists "marketing_roles_read" on public.roles;
drop policy if exists "marketing_profiles_self_read" on public.profiles;
drop policy if exists "marketing_profiles_admin_read" on public.profiles;
drop policy if exists "marketing_profiles_admin_write" on public.profiles;
drop policy if exists "marketing_admin_profiles_self_or_admin_read" on public.admin_profiles;
drop policy if exists "marketing_admin_profiles_admin_write" on public.admin_profiles;
drop policy if exists "marketing_site_settings_public_read" on public.site_settings;
drop policy if exists "marketing_site_settings_staff_write" on public.site_settings;
drop policy if exists "marketing_products_public_read" on public.products;
drop policy if exists "marketing_products_staff_write" on public.products;
drop policy if exists "marketing_services_public_read" on public.services;
drop policy if exists "marketing_services_staff_write" on public.services;
drop policy if exists "marketing_quote_requests_public_insert" on public.quote_requests;
drop policy if exists "marketing_quote_requests_staff_read" on public.quote_requests;
drop policy if exists "marketing_quote_requests_staff_update" on public.quote_requests;
drop policy if exists "marketing_orders_staff_read" on public.orders;
drop policy if exists "marketing_orders_staff_update" on public.orders;
drop policy if exists "marketing_media_public_read" on public.media_assets;
drop policy if exists "marketing_media_staff_write" on public.media_assets;

create policy "marketing_roles_read" on public.roles for select to authenticated using (true);
create policy "marketing_profiles_self_read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "marketing_profiles_admin_read" on public.profiles for select to authenticated using (public.is_admin());
create policy "marketing_profiles_admin_write" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketing_admin_profiles_self_or_admin_read" on public.admin_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "marketing_admin_profiles_admin_write" on public.admin_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketing_site_settings_public_read" on public.site_settings for select to anon, authenticated using (true);
create policy "marketing_site_settings_staff_write" on public.site_settings for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_products_public_read" on public.products for select to anon, authenticated using (enabled = true);
create policy "marketing_products_staff_write" on public.products for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_services_public_read" on public.services for select to anon, authenticated using (enabled = true);
create policy "marketing_services_staff_write" on public.services for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_quote_requests_public_insert" on public.quote_requests for insert to anon, authenticated with check (true);
create policy "marketing_quote_requests_staff_read" on public.quote_requests for select to authenticated using (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_quote_requests_staff_update" on public.quote_requests for update to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_orders_staff_read" on public.orders for select to authenticated using (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_orders_staff_update" on public.orders for update to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));
create policy "marketing_media_public_read" on public.media_assets for select to anon, authenticated using (true);
create policy "marketing_media_staff_write" on public.media_assets for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('product-images', 'product-images', true),
  ('certificates', 'certificates', true),
  ('inspection-photos', 'inspection-photos', true),
  ('event-medical', 'event-medical', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "marketing_storage_public_read" on storage.objects;
drop policy if exists "marketing_storage_staff_insert" on storage.objects;
drop policy if exists "marketing_storage_staff_update" on storage.objects;
drop policy if exists "marketing_storage_staff_delete" on storage.objects;

create policy "marketing_storage_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id in ('logos', 'product-images', 'certificates', 'inspection-photos', 'event-medical'));

create policy "marketing_storage_staff_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('logos', 'product-images', 'certificates', 'inspection-photos', 'event-medical')
  and public.current_user_role() in ('administrator', 'editor')
);

create policy "marketing_storage_staff_update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('logos', 'product-images', 'certificates', 'inspection-photos', 'event-medical')
  and public.current_user_role() in ('administrator', 'editor')
)
with check (
  bucket_id in ('logos', 'product-images', 'certificates', 'inspection-photos', 'event-medical')
  and public.current_user_role() in ('administrator', 'editor')
);

create policy "marketing_storage_staff_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('logos', 'product-images', 'certificates', 'inspection-photos', 'event-medical')
  and public.current_user_role() in ('administrator', 'editor')
);
