const { productsHandler, getProductById, saveQuoteRequest, saveOrderRecord } = require('./content');
const { normalizeLeadOrder, syncToPulse } = require('./pulse');

let stripeClient;
function stripeKeyMode(key) {
  if (!key) return 'missing';
  if (key.startsWith('sk_test_') || key.startsWith('pk_test_')) return 'test';
  if (key.startsWith('sk_live_') || key.startsWith('pk_live_')) return 'live';
  return 'unknown';
}

function stripeStatusBody() {
  const secretMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY || '');
  const publishableMode = stripeKeyMode(process.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const configured = secretMode !== 'missing';
  const mode = secretMode === 'test' && ['test', 'missing'].includes(publishableMode)
    ? 'test'
    : secretMode === 'live' && ['live', 'missing'].includes(publishableMode)
      ? 'live'
      : configured
        ? 'mismatch'
        : 'not_configured';
  const warnings = [];
  if (!configured) warnings.push('Stripe secret key is not configured.');
  if (secretMode === 'unknown') warnings.push('Stripe secret key does not use a recognized test or live prefix.');
  if (publishableMode === 'unknown') warnings.push('Stripe publishable key does not use a recognized test or live prefix.');
  if (configured && publishableMode !== 'missing' && secretMode !== publishableMode) warnings.push('Stripe secret and publishable keys appear to be from different modes.');
  if (!webhookConfigured) warnings.push('Stripe webhook signing secret is not configured.');
  return {
    configured,
    mode,
    secretKeyMode: secretMode,
    publishableKeyMode: publishableMode,
    webhookConfigured,
    testMode: mode === 'test',
    liveMode: mode === 'live',
    warnings
  };
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1000000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function siteUrl(req) {
  return process.env.SITE_URL || `http://${req.headers.host || 'localhost:3000'}`;
}

async function createCheckoutSession(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const stripe = getStripe();
  if (!stripe) return json(res, 503, { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY before accepting payments.' });

  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  const product = await getProductById(body.productId);
  if (!product) return json(res, 404, { error: 'Product not found' });
  if (!['buy_now', 'deposit_only'].includes(product.mode)) return json(res, 400, { error: 'This item is not available for Stripe Checkout' });
  if (!Number.isInteger(product.amount) || product.amount < 50) return json(res, 400, { error: 'Invalid server-side product amount' });

  const customer = body.customer || {};
  const metadata = {
    product_id: product.id,
    product_category: product.category,
    product_mode: product.mode,
    stripe_mode: stripeStatusBody().mode,
    organization: String(customer.organization || '').slice(0, 500),
    phone: String(customer.phone || '').slice(0, 100),
    notes: String(customer.notes || '').slice(0, 500)
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${siteUrl(req)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl(req)}/checkout/cancel?product=${encodeURIComponent(product.id)}`,
      customer_email: customer.email || undefined,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      client_reference_id: product.id,
      metadata,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: {
            name: product.mode === 'deposit_only' ? `${product.name} - Deposit` : product.name,
            description: product.description,
            images: product.image && product.image.startsWith('http') ? [product.image] : undefined
          }
        }
      }]
    });

    const normalized = normalizeLeadOrder({
      type: 'purchase',
      customer: customer.name,
      organization: customer.organization,
      email: customer.email,
      phone: customer.phone,
      product: product.name,
      category: product.category,
      amount: product.amount,
      status: 'checkout_started',
      notes: customer.notes,
      stripe_checkout_session_id: session.id
    });
    await saveOrderRecord(normalized);
    await syncToPulse(normalized);

    return json(res, 200, { id: session.id, url: session.url, order: normalized, stripe: stripeStatusBody() });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unable to create checkout session' });
  }
}

async function stripeStatus(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  return json(res, 200, stripeStatusBody());
}

async function quoteRequest(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const normalized = normalizeLeadOrder({
    type: 'quote_request',
    customer: body.name,
    organization: body.organization,
    email: body.email,
    phone: body.phone,
    product: body.serviceInterest,
    category: body.serviceInterest,
    amount: 0,
    status: 'New Lead',
    notes: [body.message, body.preferredContactMethod, body.preferredTimeline].filter(Boolean).join(' | '),
    preferred_contact_method: body.preferredContactMethod,
    preferred_timeline: body.preferredTimeline
  });
  await saveQuoteRequest(normalized);
  await syncToPulse(normalized);
  return json(res, 200, { ok: true, quote: normalized, emailNotification: 'not_configured' });
}

async function stripeWebhook(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const stripe = getStripe();
  if (!stripe) return json(res, 503, { error: 'Stripe is not configured' });
  const rawBody = await readRaw(req);
  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(rawBody.toString('utf8'));
    }
  } catch (error) {
    return json(res, 400, { error: `Webhook signature verification failed: ${error.message}` });
  }

  const object = event.data && event.data.object ? event.data.object : {};
  const normalized = normalizeLeadOrder({
    type: 'purchase',
    customer: object.customer_details && object.customer_details.name,
    organization: object.metadata && object.metadata.organization,
    email: object.customer_details && object.customer_details.email,
    phone: (object.customer_details && object.customer_details.phone) || (object.metadata && object.metadata.phone),
    product: object.metadata && object.metadata.product_id,
    category: object.metadata && object.metadata.product_category,
    amount: object.amount_total || object.amount_received || object.amount || 0,
    status: event.type,
    notes: object.metadata && object.metadata.notes,
    stripe_checkout_session_id: object.id && String(object.object) === 'checkout.session' ? object.id : '',
    stripe_payment_intent_id: object.payment_intent || object.id || ''
  });

  switch (event.type) {
    case 'checkout.session.completed':
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'charge.refunded':
      await saveOrderRecord(normalized);
      await syncToPulse(normalized);
      break;
    default:
      break;
  }

  return json(res, 200, { received: true, type: event.type, order: normalized });
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/products') return productsHandler(req, res);
  if (pathname === '/api/create-checkout-session') return createCheckoutSession(req, res);
  if (pathname === '/api/stripe-status') return stripeStatus(req, res);
  if (pathname === '/api/quote-request') return quoteRequest(req, res);
  if (pathname === '/api/stripe-webhook') return stripeWebhook(req, res);
  return false;
}

module.exports = { handleApi, createCheckoutSession, quoteRequest, stripeWebhook, stripeStatus, productsHandler, stripeStatusBody };
