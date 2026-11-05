const assert = require('node:assert/strict');
const fs = require('node:fs');
const catalog = require('../lib/sos-quote-catalog');
const firstAid = require('../lib/sos-first-aid-catalog');
const { getProductList } = require('../lib/content');

(async () => {
  assert.equal(new Set(catalog.map(product => product.id)).size, catalog.length);
  assert.ok(catalog.some(product => /AED Sales/.test(product.category)));
  assert.ok(catalog.some(product => /PRESTAN/.test(product.category)));
  for (const product of catalog) {
    assert.equal(product.mode, 'request_quote');
    assert.equal(product.inventory_status, 'quote_required');
    assert.equal(product.amount, 0);
    assert.equal(product.image_url, '');
  }
  process.env.SOS_CATALOG_PREVIEW = 'true';
  process.env.NODE_ENV = 'development';
  assert.equal((await getProductList(null)).length, catalog.length + firstAid.length);
  assert.ok(firstAid.every(product => product.mode === 'request_quote' && product.inventory_status === 'quote_required'));
  const existing = [{ id: 'saved', category: 'AED Sales', name: 'Saved product', enabled: true }];
  const db = { from: () => ({ select: () => ({ order: async () => ({ data: existing, error: null }) }) }) };
  assert.deepEqual((await getProductList(db)).map(product => product.id), ['saved']);
  process.env.NODE_ENV = 'production';
  delete process.env.ENABLE_DEMO_CONTENT;
  delete process.env.PUBLIC_SITE_MODE;
  assert.deepEqual(await getProductList(null), []);
  const sql = fs.readFileSync('supabase/migrations/007_sos_quote_catalog.sql', 'utf8');
  assert.match(sql, /on conflict \(id\) do nothing/i);
  for (const product of catalog) assert.ok(sql.includes("'" + product.id + "'"));
  const drafts = fs.readFileSync('supabase/migrations/009_sos_first_aid_drafts.sql', 'utf8');
  assert.match(drafts, /on conflict \(id\) do nothing/i);
  for (const product of firstAid) assert.match(drafts, new RegExp("'" + product.id + "'[^\\n]*'request_quote', false"));
  console.log('SOS quote catalog and persistence checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
