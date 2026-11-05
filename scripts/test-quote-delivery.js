const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const contentPath = require.resolve('../lib/content');
let saved;
require.cache[contentPath] = { id: contentPath, filename: contentPath, loaded: true, exports: {
  saveQuoteRequest: async record => { saved = record; },
  productsHandler: () => {}, getProductById: () => {}, saveOrderRecord: () => {}
} };
const { quoteRequest } = require('../lib/commerce');
const req = Readable.from([JSON.stringify({ name: 'Customer', email: 'customer@valid.ca', serviceInterest: 'AED Sales', message: 'AED model', deliveryPreference: 'Local delivery inquiry', deliveryLocation: 'Wallaceburg' })]);
req.method = 'POST'; req.headers = {};
let status;
const res = { writeHead(code) { status = code; }, end() {} };
quoteRequest(req, res).then(() => {
  assert.equal(status, 200);
  assert.match(saved.notes, /AED model/);
  assert.match(saved.notes, /Delivery preference: Local delivery inquiry/);
  assert.match(saved.notes, /Delivery location: Wallaceburg/);
  console.log('Quote delivery capture checks passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
