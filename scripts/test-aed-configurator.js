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
const devices = ['sos-zoll-aed-3', 'sos-zoll-aed-plus', 'sos-defibtech-lifeline', 'sos-lifeline-view'].map(id => catalog.aeds.find(item => item.id === id));
const parts = ['8000-000696', '8900-0800-01', 'DDP-100', 'DDP-2001'].map((model, index) => ({ id:`part-${index}`, name:`Part ${index}`, model }));
const registry = Object.fromEntries([...devices.map((item, index) => [item.id, { name:item.name, model:['ZOLL AED 3','ZOLL AED Plus','DDU-100','DDU-2300'][index] }]), ...parts.map(item => [item.id, { name:item.name, model:item.model }])]);
for (let i = 0; i < devices.length; i++) for (let j = 0; j < parts.length; j++) assert.equal(AedCatalog.compatible(devices[i], parts[j], registry), i === j);
assert.equal(AedCatalog.compatible(devices[0], { ...parts[0], name:'Changed product' }, registry), false);
assert.ok(catalog.accessories.every(item => !devices.some(device => AedCatalog.compatible(device, item))), 'Unverified supplier parts must not be selectable');
assert.equal(AedCatalog.quantity(3), 3);
assert.equal(AedCatalog.quantity(-1), 1);
assert.equal(AedCatalog.quantity(100), 1);
assert.deepEqual(AedCatalog.summary([{ price:25000, quantity:2 }, { price:null, quantity:1 }]), { knownSubtotal:50000, needsQuote:true });
assert.deepEqual(AedCatalog.summary([]), { knownSubtotal:0, needsQuote:true });

const app = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
const definitions = ['function configuratorItems(', 'function syncAedAccessoryControls(', 'function updateAedConfiguratorSummary(', 'function aedItemImage(', 'function aedProductCard(', 'function aedAddonCard(', 'function aedConfigurator('].map(prefix => {
  const line = app.find(item => item.startsWith(prefix));
  assert.ok(line, prefix);
  return line;
}).join('\n');
const quoteHandler = app.find(line => line.startsWith("document.addEventListener('submit',async e=>{if(e.target.id==='aed-configurator-quote-form')"));
assert.ok(quoteHandler);
const accessoryCard = { hidden:false };
let selectedAed = 'sos-zoll-aed-3';
const controls = {
  '[data-aed-qty]': [{ dataset:{ aedQty:'sos-zoll-aed-3' }, value:'2' }],
  '[data-addon]': [{ dataset:{ addon:'sos-zoll-aed-3-battery' }, checked:true, closest:() => accessoryCard }],
  '[data-addon-qty]': [{ dataset:{ addonQty:'sos-zoll-aed-3-battery' }, value:'3' }],
  '[data-aed-service]': [{ checked:true, value:'Soteria Pulse management inquiry' }]
};
const configForm = { querySelectorAll: selector => controls[selector] || [] };
const quoteForm = { id:'aed-configurator-quote-form', querySelector: () => ({ disabled:false }), reset() {}, fields:[['name','Test'],['email','test@valid.ca']] };
let submit, sent, message;
const context = {
  AedCatalog, aedConfiguratorData:catalog,
  ProductProvider:{ loadAEDConfigurator: () => catalog },
  FormData: class { constructor(form) { this.form = form; } get() { return selectedAed; } [Symbol.iterator]() { return (this.form.fields || [])[Symbol.iterator](); } },
  document:{ getElementById: id => id === 'aed-configurator-form' ? configForm : null, querySelectorAll: () => [], addEventListener: (type, fn) => { submit = fn; } },
  esc:value => String(value || ''), money:cents => '$' + (cents / 100).toFixed(2), productPath:item => '/products/' + item.id,
  hero:title => '<h1>' + title + '</h1>', setMessage: (id, html) => { message = html; },
  fetch: async (url, options) => { sent = JSON.parse(options.body); return { ok:true }; }, jsonResponse:async () => ({ ok:true })
};
vm.createContext(context);
vm.runInContext(definitions + '\n' + quoteHandler + '\nthis.renderConfigurator = aedConfigurator; this.syncAccessories = syncAedAccessoryControls;', context);
assert.match(context.renderConfigurator(), /ZOLL AED 3/);
assert.doesNotMatch(context.renderConfigurator(), /\$0\.00|data-aed-add-cart/);
context.AedCatalog = { ...AedCatalog, compatible:(device, part) => !!device && !!part && device.id === 'sos-zoll-aed-3' && part.id === 'sos-zoll-aed-3-battery' };
context.syncAccessories();
assert.equal(accessoryCard.hidden, false);
assert.equal(controls['[data-addon]'][0].checked, true);
selectedAed = 'sos-lifeline-view';
context.syncAccessories();
assert.equal(accessoryCard.hidden, true);
assert.equal(controls['[data-addon]'][0].checked, false);
assert.equal(controls['[data-addon]'][0].disabled, true);
selectedAed = 'sos-zoll-aed-3';
context.AedCatalog = AedCatalog;
(async () => {
  await submit({ target:quoteForm, preventDefault(){}, stopImmediatePropagation(){} });
  assert.deepEqual(sent.aedPackage.aed, { productId:'sos-zoll-aed-3', quantity:2 });
  assert.equal(sent.aedPackage.accessories.length, 0);
  assert.deepEqual(sent.aedPackage.services, ['Soteria Pulse management inquiry']);
  assert.match(message, /submitted/);
  console.log('AED configurator checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
