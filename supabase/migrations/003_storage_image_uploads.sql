-- Soteria Services storage buckets and policies for admin image uploads
-- Run after the auth and content migrations.

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view logos" on storage.objects;
drop policy if exists "Public can view product images" on storage.objects;
drop policy if exists "Editors can upload logos" on storage.objects;
drop policy if exists "Editors can update logos" on storage.objects;
drop policy if exists "Editors can delete logos" on storage.objects;
drop policy if exists "Editors can upload product images" on storage.objects;
drop policy if exists "Editors can update product images" on storage.objects;
drop policy if exists "Editors can delete product images" on storage.objects;

create policy "Public can view logos"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'logos');

create policy "Public can view product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "Editors can upload logos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'logos' and public.current_user_role() in ('administrator', 'editor'));

create policy "Editors can update logos"
on storage.objects
for update
to authenticated
using (bucket_id = 'logos' and public.current_user_role() in ('administrator', 'editor'))
with check (bucket_id = 'logos' and public.current_user_role() in ('administrator', 'editor'));

create policy "Editors can delete logos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'logos' and public.current_user_role() in ('administrator', 'editor'));

create policy "Editors can upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images' and public.current_user_role() in ('administrator', 'editor'));

create policy "Editors can update product images"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images' and public.current_user_role() in ('administrator', 'editor'))
with check (bucket_id = 'product-images' and public.current_user_role() in ('administrator', 'editor'));

create policy "Editors can delete product images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images' and public.current_user_role() in ('administrator', 'editor'));
