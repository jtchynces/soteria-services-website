-- Private supplier observations. No product or site settings are changed.
create table if not exists public.supplier_price_reviews (
  id uuid primary key default gen_random_uuid(),
  supplier text not null default 'SOS Technologies',
  name text not null,
  manufacturer text not null default '',
  model text not null default '',
  sku text not null default '',
  category text not null default '',
  specifications text not null default '',
  supplier_url text not null,
  retail_cents integer not null check (retail_cents >= 0),
  cost_cents integer not null check (cost_cents >= 0),
  price_verified_on date not null,
  tax_basis text not null default 'unverified' check (tax_basis in ('unverified', 'before_tax', 'includes_tax')),
  availability text not null default 'unverified',
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_price_reviews enable row level security;
revoke all on public.supplier_price_reviews from anon, public;
grant select, insert, update on public.supplier_price_reviews to authenticated;
drop policy if exists "Editors manage supplier reviews" on public.supplier_price_reviews;
create policy "Editors manage supplier reviews" on public.supplier_price_reviews
  for all to authenticated
  using (public.current_user_role() in ('administrator', 'editor'))
  with check (public.current_user_role() in ('administrator', 'editor'));
