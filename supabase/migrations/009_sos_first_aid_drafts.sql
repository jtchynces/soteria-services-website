-- Supplier collection identities only; prices, inventory and resale details require review.
-- Drafts remain unpublished. Existing records are never overwritten.
insert into public.products (id, category, name, description, amount, currency, tax_behavior, inventory_status, image_url, mode, enabled) values
  ('sos-ontario-sec9-kit-plastic', 'First Aid Kits', 'Ontario Sec. 9 First Aid Kit, Plastic', 'An Ontario Section 9 first aid kit in a plastic container.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-water-jel-pouch-kit', 'First Aid Kits', 'Water-Jel Pouch Kit', 'A Water-Jel burn care kit in a pouch.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-water-jel-emergency-kit-i', 'First Aid Kits', 'Water-Jel Emergency Burn Kit I', 'A Water-Jel emergency burn care kit.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-eye-dressing-kit', 'First Aid Kits', 'Eye Dressing Kit', 'An eye dressing kit.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-bzk-antiseptic-towelette-12', 'First Aid Supplies', 'BZK Antiseptic Towelette (12)', 'A pack of twelve antiseptic towelettes.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-bzk-antiseptic-towelette-100', 'First Aid Supplies', 'BZK Antiseptic Towelette 100', 'A pack of one hundred antiseptic towelettes.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-cpr-barrier-mask-economy', 'First Aid Supplies', 'CPR Barrier Mask Economy', 'A CPR barrier mask.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false),
  ('sos-cpr-barrier-gloves-wipe-pouch', 'First Aid Supplies', 'CPR Barrier with Gloves, Wipe and Pouch', 'A CPR barrier with gloves, a wipe and a pouch.', 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', false)
on conflict (id) do nothing;
