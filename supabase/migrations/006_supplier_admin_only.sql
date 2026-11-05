-- Restrict supplier costs and price observations to administrators.
-- Review existing policies on this table before applying to a database.
drop policy if exists "Editors manage supplier reviews" on public.supplier_price_reviews;
drop policy if exists "Administrators manage supplier reviews" on public.supplier_price_reviews;
create policy "Administrators manage supplier reviews" on public.supplier_price_reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
