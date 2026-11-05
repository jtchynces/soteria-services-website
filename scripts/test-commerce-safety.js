const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
const { quoteRequest, stripeWebhook } = require('../lib/commerce');

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
  const catalog = require('../config/aed-configurator.json');
  assert.ok([...catalog.aeds, ...catalog.accessories].every(item => !item.enabled));
  console.log('Commerce safety checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
