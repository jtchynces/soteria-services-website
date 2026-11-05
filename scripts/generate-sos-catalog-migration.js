const fs = require('node:fs');
const catalog = require('../lib/sos-quote-catalog');
const quote = value => "'" + String(value).replace(/'/g, "''") + "'";
const values = catalog.map(item => `  (${[item.id, item.category, item.name, item.description].map(quote).join(', ')}, 0, 'cad', 'confirm_manually', 'quote_required', '', 'request_quote', true)`).join(',\n');
const sql = `-- Reviewed SOS catalog identities; prices, availability and shipping require a quote.\n-- Apply only after review. Never overwrite existing products.\ninsert into public.products (id, category, name, description, amount, currency, tax_behavior, inventory_status, image_url, mode, enabled) values\n${values}\non conflict (id) do nothing;\n`;
fs.writeFileSync('supabase/migrations/007_sos_quote_catalog.sql', sql);
