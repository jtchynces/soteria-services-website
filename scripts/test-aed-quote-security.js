const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const source = require('../lib/sos-quote-catalog');
let saved = 0;
const contentPath = require.resolve('../lib/content');
require.cache[contentPath] = { id:contentPath, filename:contentPath, loaded:true, exports:{
  saveQuoteRequest:async () => { saved++; },
  getProductById:async id => source.find(product => product.id === id),
  productsHandler() {}, saveOrderRecord() {}
} };
const { quoteRequest, resolveAedPackage } = require('../lib/commerce');
const aed = { productId:'sos-zoll-aed-3', quantity:1 };
const incompatible = { productId:'sos-lifeline-view-adult-pads', quantity:1 };
async function send(body) {
  const req = Readable.from([JSON.stringify(body)]); req.method = 'POST'; req.headers = {};
  let status, result;
  await quoteRequest(req, { writeHead(code) { status = code; }, end(data) { result = JSON.parse(data); } });
  return { status, result };
}
(async () => {
  await assert.rejects(resolveAedPackage({ aed, accessories:[incompatible], services:[] }), /not verified as compatible/);
  const compatible = await resolveAedPackage({ aed, accessories:[{ productId:'sos-zoll-aed-3-battery', quantity:1 }], services:[] });
  assert.equal(compatible.accessories.length, 1);
  await assert.rejects(resolveAedPackage({ aed:{ ...aed, quantity:100 }, accessories:[], services:[] }), /quantity/);
  const body = { name:'Customer', email:'customer@valid.ca', message:'Request', aedPackage:{ aed, accessories:[incompatible], services:[] } };
  const rejected = await send(body);
  assert.equal(rejected.status, 400);
  assert.match(rejected.result.error, /not verified as compatible/);
  assert.equal(saved, 0);
  body.aedPackage.accessories = [];
  const accepted = await send(body);
  assert.equal(accepted.status, 200);
  assert.equal(saved, 1);
  assert.match(accepted.result.quote.notes, /ZOLL AED 3/);
  console.log('AED quote validation checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
