-- Soteria-Marketing diagnostic SQL
-- Run this first in the Supabase SQL editor for the marketing/e-commerce project.
-- It reports actual existing tables, columns, constraints, policies, functions, auth users, and storage buckets.

select
  'marketing_tables' as section,
  table_schema,
  table_name
from information_schema.tables
where table_schema in ('public', 'storage')
  and table_name in (
    'roles',
    'profiles',
    'admin_profiles',
    'site_settings',
    'products',
    'services',
    'quote_requests',
    'orders',
    'media_assets',
    'buckets',
    'objects'
  )
order by table_schema, table_name;

select
  'marketing_columns' as section,
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema in ('public', 'storage')
  and table_name in (
    'roles',
    'profiles',
    'admin_profiles',
    'site_settings',
    'products',
    'services',
    'quote_requests',
    'orders',
    'media_assets',
    'buckets',
    'objects'
  )
order by table_schema, table_name, ordinal_position;

select
  'marketing_constraints' as section,
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema as references_schema,
  ccu.table_name as references_table,
  ccu.column_name as references_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_schema = ccu.constraint_schema
 and tc.constraint_name = ccu.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in (
    'roles',
    'profiles',
    'admin_profiles',
    'site_settings',
    'products',
    'services',
    'quote_requests',
    'orders',
    'media_assets'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

select
  'marketing_rls' as section,
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'roles',
    'profiles',
    'admin_profiles',
    'site_settings',
    'products',
    'services',
    'quote_requests',
    'orders',
    'media_assets'
  )
order by tablename;

select
  'marketing_policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
  and tablename in (
    'roles',
    'profiles',
    'admin_profiles',
    'site_settings',
    'products',
    'services',
    'quote_requests',
    'orders',
    'media_assets',
    'objects'
  )
order by schemaname, tablename, policyname;

select
  'marketing_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_user_role',
    'is_admin',
    'handle_new_user',
    'touch_updated_at',
    'touch_content_updated_at'
  )
order by p.proname;

select
  'marketing_auth_users' as section,
  id,
  email,
  created_at,
  last_sign_in_at
from auth.users
where lower(email) in (
  'josh@soteriaservices.net',
  'shay@soteriaservices.net'
)
order by email;

select
  'marketing_storage_buckets' as section,
  id,
  name,
  public,
  created_at,
  updated_at
from storage.buckets
where id in (
  'logos',
  'product-images',
  'certificates',
  'inspection-photos',
  'event-medical'
)
order by id;
