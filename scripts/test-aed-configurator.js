const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const AedCatalog = require('../aed-catalog');
const source = require('../lib/sos-quote-catalog').map(item => ({ ...item, image: item.image_url }));
const catalog = AedCatalog.build(source);
assert.ok(catalog.aeds.some(item => item.id === 'sos-zoll-aed-3'));
assert.ok(catalog.accessories.some(item => item.id === 'sos-zoll-aed-3-battery'));
assert.ok(catalog.aeds.every(item => item.price === null));
assert.ok(!catalog.aeds.some(item => /pads|batter|trainer/i.test(item.name)));
assert.equal(AedCatalog.quantity(3), 3);
assert.equal(AedCatalog.quantity(-1), 1);
assert.equal(AedCatalog.quantity(100), 1);
assert.deepEqual(AedCatalog.summary([{ price:25000, quantity:2 }, { price:null, quantity:1 }]), { knownSubtotal:50000, needsQuote:true });
assert.deepEqual(AedCatalog.summary([]), { knownSubtotal:0, needsQuote:true });

const app = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
const definitions = ['function configuratorItems(', 'function updateAedConfiguratorSummary(', 'function aedItemImage(', 'function aedProductCard(', 'function aedAddonCard(', 'function aedConfigurator('].map(prefix => {
  const line = app.find(item => item.startsWith(prefix));
  assert.ok(line, prefix);
  return line;
}).join('\n');
const quoteHandler = app.find(line => line.startsWith("document.addEventListener('submit',async e=>{if(e.target.id==='aed-configurator-quote-form')"));
assert.ok(quoteHandler);
const controls = {
  '[data-aed-qty]': [{ dataset:{ aedQty:'sos-zoll-aed-3' }, value:'2' }],
  '[data-addon]': [{ dataset:{ addon:'sos-zoll-aed-3-battery' }, checked:true }],
  '[data-addon-qty]': [{ dataset:{ addonQty:'sos-zoll-aed-3-battery' }, value:'3' }],
  '[data-aed-service]': [{ checked:true, value:'Soteria Pulse management inquiry' }]
};
const configForm = { querySelectorAll: selector => controls[selector] || [] };
const quoteForm = { id:'aed-configurator-quote-form', querySelector: () => ({ disabled:false }), reset() {}, fields:[['name','Test'],['email','test@valid.ca']] };
let submit, sent, message;
const context = {
  AedCatalog, aedConfiguratorData:catalog,
  ProductProvider:{ loadAEDConfigurator: () => catalog },
  FormData: class { constructor(form) { this.form = form; } get() { return 'sos-zoll-aed-3'; } [Symbol.iterator]() { return (this.form.fields || [])[Symbol.iterator](); } },
  document:{ getElementById: id => id === 'aed-configurator-form' ? configForm : null, querySelectorAll: () => [], addEventListener: (type, fn) => { submit = fn; } },
  esc:value => String(value || ''), money:cents => '$' + (cents / 100).toFixed(2), productPath:item => '/products/' + item.id,
  hero:title => '<h1>' + title + '</h1>', setMessage: (id, html) => { message = html; },
  fetch: async (url, options) => { sent = JSON.parse(options.body); return { ok:true }; }, jsonResponse:async () => ({ ok:true })
};
vm.createContext(context);
vm.runInContext(definitions + '\n' + quoteHandler + '\nthis.renderConfigurator = aedConfigurator;', context);
assert.match(context.renderConfigurator(), /ZOLL AED 3/);
assert.doesNotMatch(context.renderConfigurator(), /\$0\.00|data-aed-add-cart/);
(async () => {
  await submit({ target:quoteForm, preventDefault(){}, stopImmediatePropagation(){} });
  assert.match(sent.message, /ZOLL AED 3 \[sos-zoll-aed-3\] x 2/);
  assert.match(sent.message, /Battery Pack \[sos-zoll-aed-3-battery\] x 3/);
  assert.match(sent.message, /Soteria Pulse management inquiry/);
  assert.match(sent.message, /Final total requires quotation/);
  assert.doesNotMatch(sent.message, /\$0\.00/);
  assert.match(message, /submitted/);
  console.log('AED configurator checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
