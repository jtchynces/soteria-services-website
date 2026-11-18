const assert = require('node:assert/strict');
const sections = require('../catalogue-sections');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;
delete process.env.ENABLE_DEMO_CONTENT;
delete process.env.SOS_CATALOG_PREVIEW;
delete process.env.ENABLE_STRIPE_SANDBOX_CHECKOUT;
delete process.env.STRIPE_SECRET_KEY;
process.env.NODE_ENV = 'production';

const { getProductList } = require('../lib/content');
const rows = [{ id: 'saved', category: 'First Aid Training', name: 'Saved course', amount: 100, enabled: true, mode: 'request_quote' }];
const db = (error) => ({ from: () => ({ select: () => ({ order: async () => ({ data: error ? null : rows, error }) }) }) });

function counts(list) {
  return {
    total: list.length,
    aed: list.filter(sections.isAedPageProduct).length,
    training: list.filter(sections.isTrainingProduct).length,
    equipment: list.filter(sections.isEquipmentProduct).length
  };
}

(async () => {
  process.env.SOS_PRICED_CATALOGUE = 'TRUE';
  const upper = await getProductList(db(null));
  assert.ok(upper.length > 1500);
  assert.ok(upper.some((product) => product.id === 'saved'));
  assert.equal(upper.some((product) => String(product.id).startsWith('soteria-course-')), false);
  assert.ok(!JSON.stringify(upper).match(/cost_cents|cost_basis|tp_cents/));

  process.env.SOS_PRICED_CATALOGUE = ' true ';
  const spaced = await getProductList(db(null));
  assert.equal(spaced.length, upper.length);

  process.env.SOS_PRICED_CATALOGUE = '"true"';
  const quoted = await getProductList(db(null));
  assert.deepEqual(quoted.map((product) => product.id), ['saved']);

  process.env.SOS_PRICED_CATALOGUE = 'true';
  const fallback = await getProductList(db({ message: 'products query failed' }));
  assert.equal(fallback.some((product) => product.id === 'saved'), false);
  assert.ok(fallback.length > 1500);
  assert.ok(!JSON.stringify(fallback).match(/cost_cents|cost_basis|tp_cents/));
  const priced = counts(fallback);

  delete process.env.SOS_PRICED_CATALOGUE;
  assert.deepEqual(await getProductList(db({ message: 'products query failed' })), []);
  assert.deepEqual((await getProductList(db(null))).map((product) => product.id), ['saved']);

  console.log('Section counts:', priced);
  console.log('Priced catalogue flag checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
