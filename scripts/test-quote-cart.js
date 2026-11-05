const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const catalog = [...require('../lib/sos-quote-catalog'), ...require('../lib/sos-first-aid-catalog')];
const AedCatalog = require('../aed-catalog');
const saved = [], seen = new Set();
const contentPath = require.resolve('../lib/content');
require.cache[contentPath] = { id:contentPath, filename:contentPath, loaded:true, exports:{
  getProductById:async id => catalog.find(item => item.id === id),
  saveQuoteRequest:async (record, id) => { if (seen.has(id)) return { duplicate:true }; seen.add(id); saved.push(record); return { duplicate:false }; },
  productsHandler() {}, saveOrderRecord() {}
} };
const { quoteRequest, resolveQuoteCart } = require('../lib/commerce');
async function api(body) {
  const req = Readable.from([JSON.stringify(body)]); req.method='POST'; req.headers={};
  let status, result;
  await quoteRequest(req, { writeHead(value){ status=value; }, end(value){ result=JSON.parse(value); } });
  return { ok:status===200, status, result };
}
const listeners = {}, storage = new Map(), badge = { textContent:'' }, messages = [];
let renderCount = 0, fetched = 0, pendingRelease;
const context = {
  document:{ addEventListener(type, fn){ if (!listeners[type]) listeners[type]=[]; listeners[type].push(fn); }, getElementById(id){ return id==='quote-cart-count' ? badge : null; } },
  localStorage:{ getItem:key => storage.get(key) || null, setItem:(key, value) => storage.set(key, value) },
  products:() => catalog, AedCatalog,
  esc:value => String(value || '').replace(/[&<>"']/g, ''), hero:() => '',
  render:() => { renderCount++; }, go(){}, setMessage:(id, value) => messages.push(value),
  FormData:class { constructor(form){ this.form=form; } [Symbol.iterator](){ return Object.entries(this.form.fields)[Symbol.iterator](); } },
  crypto:{ randomUUID:() => '10000000-0000-4000-8000-000000000001' },
  fetch:async (url, options) => { fetched++; await new Promise(resolve => { pendingRelease=resolve; }); const out=await api(JSON.parse(options.body)); return { ok:out.ok, payload:out.result }; },
  jsonResponse:async response => response.payload
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('quote-cart.js', 'utf8') + '\nthis.cart = QuoteCart;', context);
const aed='sos-zoll-aed-3', battery='sos-zoll-aed-3-battery', pads='sos-lifeline-view-adult-pads', kit='sos-ontario-sec9-kit-plastic';
(async () => {
  context.cart.add([{ productId:aed, quantity:1 }, { productId:battery, quantity:2 }, { productId:kit, quantity:1 }], ['Training inquiry']);
  assert.equal(badge.textContent, '4');
  assert.match(context.cart.renderPage(), /8000-000696/);
  assert.doesNotMatch(context.cart.renderPage(), /\$0\.00/);
  const beforeChange = renderCount;
  listeners.change[0]({ target:{ matches:selector => selector === '[data-quote-quantity]', dataset:{ quoteQuantity:'2' }, value:'3' } });
  assert.equal(context.cart.read().items[2].quantity, 3);
  assert.equal(badge.textContent, '6');
  assert.equal(renderCount, beforeChange, 'quantity changes must not reset contact fields');
  const bad = { items:[{ productId:aed, quantity:1 }, { productId:pads, quantity:1 }], services:[] };
  await assert.rejects(resolveQuoteCart(bad), /not verified as compatible/);
  await assert.rejects(resolveQuoteCart({ items:[{ productId:aed, quantity:0 }], services:[] }), /quantity/);
  await assert.rejects(resolveQuoteCart({ items:[{ productId:aed, quantity:1 }, { productId:aed, quantity:1 }], services:[] }), /quantity/);
  const submitButton = { disabled:false, textContent:'' };
  const form = { id:'quote-cart-form', fields:{ name:'Customer', email:'customer@valid.ca', deliveryLocation:'Wallaceburg', message:'Please advise' }, querySelector:() => submitButton };
  const event = { target:form, preventDefault(){}, stopImmediatePropagation(){} };
  const first = listeners.submit[0](event);
  await listeners.submit[0](event);
  assert.equal(fetched, 1, 'a second click must not start a request');
  assert.equal(submitButton.disabled, true);
  pendingRelease(); await first;
  assert.equal(saved.length, 1);
  assert.match(saved[0].notes, /ZOLL AED 3 \[sos-zoll-aed-3\] x 1/);
  assert.match(saved[0].notes, /8000-000696.*x 2/);
  assert.match(saved[0].notes, /Ontario Sec\. 9.*x 3/);
  assert.match(saved[0].notes, /Training inquiry/);
  assert.match(saved[0].notes, /Wallaceburg/);
  assert.equal(context.cart.read().items.length, 0);
  assert.equal(badge.textContent, '0');
  assert.ok(renderCount > 0);
  const body={ name:'Customer', email:'customer@valid.ca', requestId:'10000000-0000-4000-8000-000000000001', quoteCart:{ items:[{ productId:aed, quantity:1 }], services:[] } };
  const repeated=await api(body);
  assert.equal(repeated.result.duplicate, true);
  assert.equal(saved.length, 1);
  context.cart.add([{ productId:kit, quantity:1 }]);
  const remove={ dataset:{ quoteRemove:'0' } };
  listeners.click[0]({ target:{ closest:selector => selector==='[data-quote-remove]' ? remove : null } });
  assert.equal(context.cart.read().items.length, 0);
  console.log('Quote cart workflow and server validation checks passed.');
})().catch(error => { console.error(error); process.exitCode=1; });
