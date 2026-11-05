const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
const { quoteRequest, stripeWebhook, resolveCheckoutItems, createCheckoutSession } = require('../lib/commerce');

async function call(handler, body, headers = {}) {
  const req = Readable.from([JSON.stringify(body)]);
  req.method = 'POST';
  req.headers = headers;
  let status;
  let payload;
  const res = {
    writeHead(code) { status = code; },
    end(data) { payload = JSON.parse(data); }
  };
  await handler(req, res);
  return { status, payload };
}

(async () => {
  const invalid = await call(quoteRequest, { name: '', email: 'bad' });
  assert.equal(invalid.status, 400);
  const unsaved = await call(quoteRequest, { name: 'Client', email: 'client@valid.ca' });
  assert.equal(unsaved.status, 503);
  assert.match(unsaved.payload.error, /could not be saved/i);
  const unsigned = await call(stripeWebhook, { type: 'checkout.session.completed', data: { object: {} } });
  assert.equal(unsigned.status, 503);
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
  const forged = await call(stripeWebhook, { type: 'checkout.session.completed', data: { object: {} } }, { 'stripe-signature': 'invalid' });
  assert.equal(forged.status, 400);
  process.env.STRIPE_SECRET_KEY = 'sk_live_local_only';
  const live = await call(createCheckoutSession, { productId: 'a' });
  assert.equal(live.status, 503);
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
  const records = {
    a: { id: 'a', name: 'AED', mode: 'buy_now', amount: 120000, currency: 'cad', tax_behavior: 'non_taxable' },
    b: { id: 'b', name: 'Pads', mode: 'buy_now', amount: 8000, currency: 'cad', tax_behavior: 'non_taxable' }
  };
  const lookup = async id => records[id];
  const cart = await resolveCheckoutItems([{ productId: 'a', quantity: 1, price: 1 }, { productId: 'b', quantity: 2, price: 1 }], lookup);
  assert.equal(cart.reduce((sum, item) => sum + item.product.amount * item.quantity, 0), 136000);
  await assert.rejects(() => resolveCheckoutItems([{ productId: 'a', quantity: -1 }], lookup));
  await assert.rejects(() => resolveCheckoutItems([{ productId: 'missing', quantity: 1 }], lookup));
  await assert.rejects(() => resolveCheckoutItems([{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 1 }], lookup));
  await assert.rejects(() => resolveCheckoutItems([{ productId: 'a', quantity: 1 }], async () => ({ ...records.a, tax_behavior: 'confirm_manually' })));
  const catalog = require('../config/aed-configurator.json');
  assert.ok([...catalog.aeds, ...catalog.accessories].every(item => !item.enabled));
  console.log('Commerce safety checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
