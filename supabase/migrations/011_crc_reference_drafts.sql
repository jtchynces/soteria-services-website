-- Development only. CRC price list, release date 2026-01-15, pages 2-3.
-- Retail prices are unapproved references; no item is published or checkout-enabled.
-- TP costs are intentionally not included in this repository migration.
with reference(id, category, name, languages, cents) as (values
  ('crc-online-dogs-cats','Online Courses','First Aid for Dogs & Cats','English & French',3000),
  ('crc-online-opioid','Online Courses','First Aid for Opioid Poisoning','English & French',3000),
  ('crc-online-pfa-self-care','Online Courses','Psychological First Aid - Self-Care','English & French',2000),
  ('crc-online-pfa-caring','Online Courses','Psychological First Aid - Caring for Others','English & French',2000),
  ('crc-online-whmis-2015','Online Courses','WHIMIS 2015','English & French',3795),
  ('crc-online-bloodborne','Online Courses','Bloodborne Pathogens','English & French',3495),
  ('crc-online-bear-travelling','Online Courses','Bear Aware: Travelling in Bear Country','English & French',1995),
  ('crc-online-bear-working','Online Courses','Bear Aware: Working in Bear Country','English & French',1995),
  ('crc-online-confined','Online Courses','Confined Space Awareness','English & French',2495),
  ('crc-online-ppe','Online Courses','Personal Protective Equipment (PPE) Awareness','English & French',2495),
  ('crc-online-fire','Online Courses','Fire Safety','English & French',2495),
  ('crc-online-lockout','Online Courses','Lockout/Tagout','English & French',2495),
  ('crc-online-medical-terminology','Online Courses','Medical Terminology','English',28000),
  ('crc-online-h2s','Online Courses','H2S Awareness','English',2495),
  ('crc-online-tdg','Online Courses','Transportation of Dangerous Goods','English',3495),
  ('crc-online-tdg-energy','Online Courses','Transportation of Dangerous Goods - Energy Services','English',3495),
  ('crc-i0009340','Training Materials','First Aid & CPR Learner Guide','English & French',850),
  ('crc-i0009341','Training Materials','CPR Learner Guide','English & French',750),
  ('crc-i0009385','Training Materials','Child Care Learner Guide','English & French',750),
  ('crc-i0005923','Training Materials','First Aid Basics Guide','English & French',200),
  ('crc-i0005924','Training Materials','First Aid Basics Guide (Traditional)','Chinese',200),
  ('crc-i0005925','Training Materials','First Aid Basics Guide (Simplified)','Chinese',200),
  ('crc-i0007627','Training Materials','First Aid Basics Guide','Punjabi',200),
  ('crc-i0007628','Training Materials','First Aid Basics Guide','Hindi',200),
  ('crc-i0006104','Training Materials','Preventing Disease Transmission Pocket Guide','English & French',125),
  ('crc-i0000165','Training Materials','Out of Jurisdiction - BC','English',1000),
  ('crc-i0000135','Training Materials','Standard First Aid Badge','Bilingual',100),
  ('crc-i0000166','Training Materials','Emergency First Aid Badge','Bilingual',100),
  ('crc-i0000167','Training Materials','Emergency First Aid Sticker','Bilingual',25),
  ('crc-i0003170','Training Materials','First Aid Window Cling','English & French',200),
  ('crc-i0006268','Training Materials','Preventing Disease Transmission Window Cling','English & French',200),
  ('crc-i0008355','Training Materials','"All are Welcome Here" Window Cling','Bilingual',500),
  ('crc-i0005920','Training Materials','Wilderness & Remote First Aid Field Guide','English & French',2350),
  ('crc-i0006262','Training Materials','Wilderness First Responder Course','English & French',15000),
  ('crc-i0005151','Training Materials','Emergency Care for Professional Responders Text','English & French',13000),
  ('crc-i0005168','Training Materials','Basic Life Support Field Guide','English & French',1150),
  ('crc-i0000201','Training Materials','First Responder Badge','Bilingual',250),
  ('crc-i0000209','Training Materials','Emergency Care Badge','Bilingual',250),
  ('crc-i0000587','Training Materials','Babysitter Course','English & French',900),
  ('crc-i0000588','Training Materials','Stay Safe! Course','English & French',700),
  ('crc-i0005283','Training Materials','Psychological First Aid Workbook','English & French',600),
  ('crc-i0005285','Training Materials','Psychological First Aid - Look, Listen, Link, Live Cards','English & French',350)
)
insert into public.products (id, category, name, description, amount, currency, tax_behavior, inventory_status, image_url, mode, enabled)
select id, category, name,
  case when category = 'Training Materials' then 'Item number: ' || upper(id) || '. ' else '' end ||
  'Languages: ' || languages || '. CRC price list reference dated 2026-01-15. Review availability, permissions and pricing before publication.' ||
  case when category = 'Online Courses' then ' Enrollment is arranged manually; access is confirmed after enrollment.' else '' end,
  cents, 'cad', 'confirm_manually', 'review_required', '', 'request_quote', false
from reference
on conflict (id) do nothing;
