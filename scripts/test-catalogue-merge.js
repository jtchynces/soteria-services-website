const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pricedProducts } = require('../lib/priced-catalogue');
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

const { getProductList, DEFAULT_CONTENT } = require('../lib/content');
const file = pricedProducts();
const priced = file.find((product) => product.category === 'AED Devices' && product.amount > 0 && product.part_number && product.image);
const zeroTarget = file.find((product) => product.id !== priced.id && product.amount > 0 && product.name && product.part_number);
const rows = [
  { id: priced.id, category: 'AED Sales', name: 'Admin renamed AED', description: 'Kept', amount: 25000, currency: 'cad', mode: 'request_quote', enabled: true, image_url: 'https://admin.example/old.png', cost_cents: 999, cost_basis: 'secret', distributor_cost: 1 },
  { id: zeroTarget.id, category: 'AED Devices', name: '   ', description: '', amount: 0, currency: 'cad', mode: 'request_quote', enabled: true, image_url: '' },
  { id: 'db-hidden-kit', category: 'First aid kits', name: 'Hidden kit', amount: 0, enabled: false, mode: 'request_quote', cost_cents: 50 },
  { id: 'db-course', category: 'First Aid Training', name: 'Workplace first aid course', amount: 100, enabled: true, mode: 'request_quote' },
  { id: 'db-prestan', category: 'PRESTAN Equipment', name: 'Quote manikin', amount: 0, enabled: true, mode: 'request_quote' }
];
const db = { from: () => ({ select: () => ({ order: async () => ({ data: rows, error: null }) }) }) };

function counts(list) {
  return {
    aed: list.filter(sections.isAedPageProduct),
    training: list.filter(sections.isTrainingProduct),
    equipment: list.filter(sections.isEquipmentProduct)
  };
}

(async () => {
  assert.equal(DEFAULT_CONTENT.find((section) => section.slug === 'aed-sales-programs').title, 'AED');
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /slug:'aed-sales-programs',title:'AED'/);
  assert.match(app, /\{t:'AED',d:content\('aed-sales-programs'\)/);
  assert.match(app, /'aed-sales-programs':\['AED','AED Sales Ontario/);
  assert.match(app, /,'AED'\]/);
  assert.match(app, /CatalogueSections\.isAedPageProduct/);
  assert.match(app, /CatalogueSections\.isTrainingProduct/);
  assert.match(fs.readFileSync('expansion.js', 'utf8'), /CatalogueSections\.isEquipmentCategory/);
  const migration = fs.readFileSync('supabase/migrations/004_content_sections.sql', 'utf8');
  assert.match(migration, /'AED Sales & Programs'/);
  assert.doesNotMatch(migration, /set title = 'AED'/);
  const manual = fs.readFileSync('supabase/manual/rename_aed_heading.sql', 'utf8');
  assert.match(manual, /shared with production/);
  assert.match(manual, /public\.services/);
  assert.equal((manual.match(/select slug, title, updated_at/gi) || []).length, 2);
  assert.match(manual, /set title = 'AED'/);
  assert.match(manual, /slug = 'aed-sales-programs'/);
  assert.match(manual, /title is distinct from 'AED'/);
  assert.doesNotMatch(manual, /set [^;]*updated_at/i);

  process.env.SOS_PRICED_CATALOGUE = 'true';
  const merged = await getProductList(db);
  const kept = merged.find((product) => product.id === priced.id);
  assert.equal(kept.name, 'Admin renamed AED');
  assert.equal(kept.amount, 25000);
  assert.equal(kept.enabled, true);
  assert.equal(kept.category, 'AED Sales');
  assert.equal(kept.image, priced.image);
  assert.notEqual(kept.image, 'https://admin.example/old.png');
  assert.equal(kept.part_number, priced.part_number);
  if (priced.stock_label) assert.equal(kept.stock_label, priced.stock_label);
  assert.equal(kept.cost_cents, undefined);
  assert.equal(kept.cost_basis, undefined);
  assert.equal(kept.distributor_cost, undefined);

  const filled = merged.find((product) => product.id === zeroTarget.id);
  assert.equal(filled.name, zeroTarget.name);
  assert.equal(filled.amount, zeroTarget.amount);
  assert.equal(filled.part_number, zeroTarget.part_number);
  assert.equal(merged.filter((product) => product.id === priced.id).length, 1);
  assert.equal(new Set(merged.map((product) => product.id)).size, merged.length);
  assert.ok(!merged.some((product) => product.id === 'db-hidden-kit'));
  assert.ok(!JSON.stringify(merged).match(/cost_cents|cost_basis|distributor_cost|owner_cost|internal_cost/));

  const withHidden = await getProductList(db, true);
  const hidden = withHidden.filter((product) => product.id === 'db-hidden-kit');
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].enabled, false);
  assert.equal(hidden[0].cost_cents, undefined);

  const grouped = counts(merged);
  assert.equal(grouped.aed.length, 41);
  assert.ok(grouped.aed.every((product) => !/^prestan\b/i.test(product.category || '')));
  assert.ok(grouped.aed.some((product) => product.category === 'AED Devices'));
  assert.ok(grouped.aed.some((product) => product.category === 'AED Pads & Batteries'));
  assert.ok(grouped.aed.some((product) => product.category === 'AED Accessories'));
  assert.ok(grouped.aed.some((product) => product.category === 'AED Sales'));
  assert.equal(grouped.training.length, 1);
  assert.ok(grouped.training.every((product) => product.category === 'First Aid Training'));
  assert.ok(grouped.training.some((product) => product.id === 'db-course'));
  assert.ok(!grouped.training.some((product) => product.category === 'Supplier training courses (SOS)' || product.tag === 'Canadian Red Cross'));
  for (const category of ['Prestan Manikins', 'Prestan AED Trainers', 'Prestan AED Trainer Parts', 'Prestan Training Kits', 'First aid kits', 'PPE', 'Workplace first aid supplies', 'PRESTAN Equipment']) {
    assert.ok(grouped.equipment.some((product) => product.category === category), category);
  }
  assert.ok(!grouped.equipment.some((product) => product.category === 'AED Devices' || product.category === 'Supplier training courses (SOS)'));
  assert.ok(grouped.equipment.some((product) => product.id === 'db-prestan'));

  delete process.env.SOS_PRICED_CATALOGUE;
  assert.deepEqual((await getProductList(db)).map((product) => product.id), [priced.id, zeroTarget.id, 'db-course', 'db-prestan']);

  const preview = await getProductList(null, false, { localPreview: true });
  process.env.SOS_PRICED_CATALOGUE = 'true';
  const previewWithFlag = await getProductList(null, false, { localPreview: true });
  assert.ok(preview.some((product) => product.id === 'sos-prestan-adult-2000'));
  assert.equal(previewWithFlag.length, preview.length);
  const pricedOnly = await getProductList(null);
  assert.ok(pricedOnly.length > 1500);
  assert.ok(!pricedOnly.some((product) => product.id === 'db-course'));
  console.log('Catalogue merge counts:', { aed: grouped.aed.length, training: grouped.training.length, equipment: grouped.equipment.length, merged: merged.length });
  console.log('Priced catalogue merge checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
