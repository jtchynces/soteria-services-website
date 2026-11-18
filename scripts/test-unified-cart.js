const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(legacy, quote, products) {
  const data = new Map();
  if (legacy) data.set('soteria-cart', JSON.stringify(legacy));
  if (quote) data.set('soteria-quote-cart-v1', JSON.stringify(quote));
  const context = {
    document:{ addEventListener(){}, getElementById(){ return null; } },
    localStorage:{ getItem:key => data.get(key) || null, setItem:(key,value)=>data.set(key,value) },
    products:()=>products, AedCatalog:require('../aed-catalog'), hero:()=>'', esc:x=>String(x||''), money:n=>'$'+(n/100).toFixed(2)
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('quote-cart.js','utf8')+'\nthis.cart=QuoteCart;', context);
  return { context, data };
}
const verified = { id:'one', name:'Verified', enabled:true, mode:'buy_now', currency:'cad', amount:5000, tax_behavior:'non_taxable', checkout_verified:true, price_verified:true, shipping_verified:true, fulfillment_verified:true };
const unknown = { id:'two', name:'Quote only', enabled:true, mode:'request_quote' };
const mixed = setup([{ id:'one', quantity:2 }], { items:[{ productId:'two', quantity:1 }], services:[], requestId:'' }, [verified,unknown]);
assert.equal(mixed.context.cart.read().items.length,2);
assert.ok(mixed.data.has('soteria-cart'), 'the legacy cart must be preserved');
assert.doesNotMatch(mixed.context.cart.renderPage(), /data-unified-checkout|\$0\.00/);
const ready = setup(null, { items:[{ productId:'one', quantity:2 }], services:[], requestId:'' }, [verified]);
assert.match(ready.context.cart.renderPage(), /data-unified-checkout/);
assert.match(ready.context.cart.renderPage(), /\$100\.00/);
const unverified = setup(null, { items:[{ productId:'one', quantity:1 }], services:[], requestId:'' }, [{...verified, shipping_verified:false}]);
assert.doesNotMatch(unverified.context.cart.renderPage(), /data-unified-checkout/);
const pending = setup([{ id:'one', quantity:1 }], { items:[], services:[], requestId:'pending' }, [verified]);
assert.match(pending.context.cart.renderPage(), /previous cart.*preserved/i);
assert.ok(pending.data.has('soteria-cart'));
console.log('Unified cart migration and checkout checks passed.');
