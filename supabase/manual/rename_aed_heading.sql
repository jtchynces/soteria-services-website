-- The public.services row for slug aed-sales-programs is shared with production.
-- /api/content reads public.services (slug, title, summary, body, enabled, sort_order).
-- This file is not a migration and is not run by deploy. Run it by hand only
-- when you intend to rename that live heading. The statement assigns title and
-- no other column. A before-update trigger on public.services may still refresh updated_at.

select slug, title, updated_at
from public.services
where slug = 'aed-sales-programs';

update public.services
set title = 'AED'
where slug = 'aed-sales-programs'
  and title is distinct from 'AED';

select slug, title, updated_at
from public.services
where slug = 'aed-sales-programs';
