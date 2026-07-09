-- Soteria Services persistent content storage for pre-launch mode
-- Run after the auth roles/profiles migration.

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  category text not null,
  name text not null,
  description text not null default '',
  amount integer not null default 0,
  currency text not null default 'cad',
  tax_behavior text not null default 'confirm_manually' check (tax_behavior in ('taxable', 'non_taxable', 'confirm_manually')),
  inventory_status text not null default 'available',
  image_url text not null default '/assets/soteria-logo.svg',
  mode text not null default 'request_quote' check (mode in ('buy_now', 'request_quote', 'deposit_only', 'inquiry_only')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  title text not null,
  slug text not null unique,
  summary text not null default '',
  body text not null default '',
  image_url text not null default '/assets/soteria-logo.svg',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  alt_text text not null default '',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null references public.roles(name),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.touch_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at before update on public.site_settings for each row execute function public.touch_content_updated_at();
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_content_updated_at();
drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at before update on public.services for each row execute function public.touch_content_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_content_updated_at();
drop trigger if exists admin_profiles_touch_updated_at on public.admin_profiles;
create trigger admin_profiles_touch_updated_at before update on public.admin_profiles for each row execute function public.touch_content_updated_at();

alter table public.site_settings enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.quote_requests enable row level security;
alter table public.orders enable row level security;
alter table public.media_assets enable row level security;
alter table public.admin_profiles enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Public can read enabled products" on public.products;
drop policy if exists "Editors can manage products" on public.products;
drop policy if exists "Public can read enabled services" on public.services;
drop policy if exists "Editors can manage services" on public.services;
drop policy if exists "Public can submit quote requests" on public.quote_requests;
drop policy if exists "Editors can read quote requests" on public.quote_requests;
drop policy if exists "Editors can update quote requests" on public.quote_requests;
drop policy if exists "Editors can read orders" on public.orders;
drop policy if exists "Service role writes orders" on public.orders;
drop policy if exists "Editors can update orders" on public.orders;
drop policy if exists "Public can read media assets" on public.media_assets;
drop policy if exists "Editors can manage media assets" on public.media_assets;
drop policy if exists "Administrators can read admin profiles" on public.admin_profiles;
drop policy if exists "Administrators can manage admin profiles" on public.admin_profiles;

create policy "Public can read site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins can manage site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public can read enabled products" on public.products for select to anon, authenticated using (enabled = true);
create policy "Editors can manage products" on public.products for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));

create policy "Public can read enabled services" on public.services for select to anon, authenticated using (enabled = true);
create policy "Editors can manage services" on public.services for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));

create policy "Public can submit quote requests" on public.quote_requests for insert to anon, authenticated with check (true);
create policy "Editors can read quote requests" on public.quote_requests for select to authenticated using (public.current_user_role() in ('administrator', 'editor'));
create policy "Editors can update quote requests" on public.quote_requests for update to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));

create policy "Editors can read orders" on public.orders for select to authenticated using (public.current_user_role() in ('administrator', 'editor'));
create policy "Service role writes orders" on public.orders for insert to authenticated with check (true);
create policy "Editors can update orders" on public.orders for update to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));

create policy "Public can read media assets" on public.media_assets for select to anon, authenticated using (true);
create policy "Editors can manage media assets" on public.media_assets for all to authenticated using (public.current_user_role() in ('administrator', 'editor')) with check (public.current_user_role() in ('administrator', 'editor'));

create policy "Administrators can read admin profiles" on public.admin_profiles for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy "Administrators can manage admin profiles" on public.admin_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
