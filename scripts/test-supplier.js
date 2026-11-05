const assert = require('node:assert/strict');
const { prepareObservation, supplierReviewsHandler } = require('../lib/supplier');

const input = { name: 'PRESTAN equipment', supplier_url: 'https://www.sostor.com/products/item', retail_cents: 200000, price_verified_on: '2025-01-01', cost_cents: 130000, review_status: 'reviewed' };
const row = prepareObservation(input);
assert.equal(row.retail_cents, 200000);
assert.equal(row.cost_cents, 130000);
assert.equal(row.retail_cents - row.cost_cents, 70000);
assert.equal(row.review_status, 'pending');
assert.equal(row.tax_basis, 'unverified');
assert.equal(prepareObservation({ ...input, cost_cents: 0 }).cost_cents, 0);
const sos = prepareObservation({ ...input, pricing_method:'sos_discount', category:'First Aid Supplies', discount_confirmed:true, cost_cents:1 });
assert.equal(sos.cost_cents, 150000);
assert.equal(sos.pricing_method, 'sos_discount');
for (const method of ['prestan_spreadsheet', 'aed_spreadsheet']) {
  const spreadsheet = prepareObservation({ ...input, pricing_method:method, supplier_url:'', source_name:'Approved source', sku:'SKU-1', map_cents:190000 });
  assert.equal(spreadsheet.cost_cents, 130000);
  assert.equal(spreadsheet.map_cents, 190000);
  assert.throws(() => prepareObservation({ ...input, pricing_method:method, source_name:'Approved source', sku:'SKU-1', map_cents:200001 }));
  assert.throws(() => prepareObservation({ ...input, pricing_method:method, source_name:'Approved source', sku:'SKU-1', map_cents:'' }));
}
assert.throws(() => prepareObservation({ ...input, pricing_method:'sos_discount', category:'First Aid Supplies' }));
assert.throws(() => prepareObservation({ ...input, pricing_method:'sos_discount', category:'PRESTAN Equipment', discount_confirmed:true }));
for (const change of [{ supplier_url: 'https://evil.example/products/item' }, { retail_cents: '' }, { retail_cents: -1 }, { cost_cents: '' }, { cost_cents: -1 }, { price_verified_on: '2025-02-30' }, { price_verified_on: '2999-01-01' }]) {
  assert.throws(() => prepareObservation({ ...input, ...change }));
}
const req = { method: 'GET', headers: {} };
let status, response;
const res = { writeHead(value) { status = value; }, end(value) { response = JSON.parse(value); } };
supplierReviewsHandler(req, res).then(() => {
  assert.equal(status, 401);
  assert.equal(response.error, 'Missing access token');
  console.log('Supplier pricing and access checks passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
