-- New metadata only. Existing costs and products are not changed.
alter table public.supplier_price_reviews
  add column if not exists pricing_method text not null default 'legacy_unverified',
  add column if not exists source_name text not null default '',
  add column if not exists map_cents integer,
  add column if not exists discount_confirmed boolean not null default false;
