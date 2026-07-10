-- Soteria Services page content sections for the marketing website.
-- Safe to rerun. Seeds only when the services table is empty.

create table if not exists public.services (
  id text primary key,
  title text not null,
  slug text not null unique,
  summary text not null default '',
  body text not null default '',
  image_url text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.services (id, slug, title, summary, body, image_url, enabled, sort_order)
select id, slug, title, summary, body, '', true, sort_order
from (values
  ('home', 'home', 'Soteria Services', 'Start a purchase, pay a deposit, request a quote, or book a discovery call for practical safety and preparedness services.', 'Simple commerce and quote workflows for the services Soteria is ready to sell.', 10),
  ('why-soteria', 'why-soteria', 'Why Soteria?', 'Soteria Services exists because emergency preparedness should never be an afterthought. We help organizations protect their people, reduce risk, and build confidence through practical training, safety programs, medical readiness, and emergency preparedness solutions.', 'Preparedness should be clear, useful, and grounded in real-world response needs.', 20),
  ('first-aid-training', 'first-aid-training', 'First Aid Training', 'First Aid Training Chatham-Kent and CPR Training Chatham-Kent for workplaces, teams, and organizations.', 'First Aid and CPR training options for organizations preparing their teams.', 30),
  ('aed-sales-programs', 'aed-sales-programs', 'AED Sales & Programs', 'AED Sales Ontario, AED Programs for Businesses, first aid kits, and AED readiness support.', 'AED sales, program setup, supplies, and readiness support for workplaces and organizations.', 40),
  ('event-medical-services', 'event-medical-services', 'Event Medical Services', 'Professional event first aid and medical standby coverage for community events, workplace events, festivals, private events, sporting events, training events, and public gatherings.', 'Event first aid coverage, medical standby, incident documentation, AED availability, first aid station setup, planning, and post-event summaries.', 50),
  ('mask-fit-testing', 'mask-fit-testing', 'Mask Fit Testing', 'Qualitative respirator fit testing for workplaces, healthcare-adjacent settings, industrial clients, emergency services, construction, and organizations requiring respiratory protection.', 'Mask fit testing appointments, group bookings, workplace sessions, documentation, and annual or periodic testing support.', 60),
  ('contact-cta', 'contact-cta', 'Contact Soteria Services', 'Request a quote, start a purchase, pay a deposit, or book a discovery call.', 'Soteria Services will follow up to confirm details, scheduling, and next steps.', 70)
) as seed(id, slug, title, summary, body, sort_order)
where not exists (select 1 from public.services)
on conflict (id) do nothing;
