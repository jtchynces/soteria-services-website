const assert = require('node:assert/strict');
const fs = require('node:fs');

process.env.PUBLIC_SITE_MODE = 'coming_soon';
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;
delete process.env.SOS_CATALOG_PREVIEW;
delete process.env.SOS_PRICED_CATALOGUE;
delete process.env.ENABLE_DEMO_CONTENT;

const rows = [{ key: 'public_site_mode', value: 'coming_soon' }, { key: 'company_logo_url', value: 'https://valid.test/logo.png' }];
const products = [{ id: 'saved', name: 'Saved Product', category: 'AED Sales', enabled: true, mode: 'request_quote' }];
const db = { from(table) { return { select() {
  if (table === 'site_settings') return Promise.resolve({ data: rows, error: null });
  if (table === 'products') return { order: async () => ({ data: products, error: null }) };
  throw new Error('Unexpected table');
} }; } };
const supabasePath = require.resolve('@supabase/supabase-js');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: { createClient: () => db } };
const { publicSettingsHandler, productsHandler, getProductList } = require('../lib/content');

async function call(handler, options) {
  let status, body;
  await handler({ method: 'GET', headers: {}, query: { localPreview: true } }, {
    writeHead(code) { status = code; }, end(value) { body = JSON.parse(value); }
  }, options);
  assert.equal(status, 200);
  return body;
}

(async () => {
  assert.equal((await call(publicSettingsHandler)).settings.public_site_mode, 'coming_soon');
  assert.equal((await call(publicSettingsHandler, { localPreview: true })).settings.public_site_mode, 'live');
  assert.equal((await call(productsHandler)).products.length, 0);
  const preview = await call(productsHandler, { localPreview: true });
  assert.ok(preview.products.some(item => item.category === 'PRESTAN Equipment'));
  assert.ok(preview.products.every(item => item.mode === 'request_quote'));
  process.env.SUPABASE_URL = 'https://valid.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test';
  const local = (await call(publicSettingsHandler, { localPreview: true })).settings;
  assert.equal(local.public_site_mode, 'live');
  assert.equal(local.company_logo_url, 'https://valid.test/logo.png');
  assert.equal(rows[0].value, 'coming_soon');
  assert.equal((await call(publicSettingsHandler)).settings.public_site_mode, 'coming_soon');
  assert.deepEqual((await getProductList(db, false, { localPreview: true })).map(item => item.id), ['saved', 'soteria-course-first-responder', 'soteria-course-emr', 'soteria-course-oxygen-airways']);
  assert.match(fs.readFileSync('package.json', 'utf8'), /node server\.js --local-preview/);
  assert.match(fs.readFileSync('server.js', 'utf8'), /localPreview \? '127\.0\.0\.1'/);
  console.log('Local preview isolation checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
