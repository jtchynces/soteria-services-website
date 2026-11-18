const assert = require('node:assert/strict');
const { sheetCompatible, exclusiveGroup } = require('../aed-sheet');
const { mergePreview } = require('../lib/priced-catalogue');
const quote = require('../lib/sos-quote-catalog');
const aid = require('../lib/sos-first-aid-catalog');

const zoll = { id: 'sos-zoll-aed-3', name: 'ZOLL AED 3', part_number: 'ZOLL AED 3' };
assert.equal(sheetCompatible(zoll, { part_number: '8000-000696' }), true);
assert.equal(sheetCompatible(zoll, { part_number: 'DDP-2001' }), false);
assert.equal(sheetCompatible(zoll, { part_number: 'PAD-PAK-01' }), false);
assert.equal(exclusiveGroup({ part_number: 'DDP-100' }), 'pads');
assert.equal(exclusiveGroup({ part_number: '8000-000696' }), '');
assert.equal(exclusiveGroup({ part_number: 'PAD-PAK-01' }), '');

delete process.env.ENABLE_STRIPE_SANDBOX_CHECKOUT;
delete process.env.STRIPE_SECRET_KEY;
const merged = mergePreview(quote.concat(aid).map(product => ({ ...product, image: product.image_url })));
assert.ok(merged.length > quote.length);
assert.ok(merged.every(product => product.mode === 'request_quote'));
assert.equal(merged.find(product => product.id === 'sos-zoll-aed-3').name, 'ZOLL AED 3');
assert.ok(merged.find(product => product.id === 'sos-zoll-aed-3').amount > 0);
assert.ok(!JSON.stringify(merged).includes('cost_cents'));
console.log('Priced catalogue checks passed.');
