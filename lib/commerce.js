const { productsHandler, getProductById, saveQuoteRequest, saveOrderRecord } = require('./content');
const { normalizeLeadOrder, syncToPulse } = require('./pulse');

let stripeClient;
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

async function resolveCheckoutItems(items, lookup = getProductById) {
  if (!Array.isArray(items) || !items.length || items.length > 30) throw new Error('Choose between 1 and 30 products.');
  const seen = new Set();
  const resolved = [];
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !item.productId || seen.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Invalid cart item or quantity.');
    seen.add(item.productId);
    const product = await lookup(item.productId);
    if (!product || !['buy_now', 'deposit_only'].includes(product.mode)) throw new Error('A cart item is no longer available for checkout.');
    if (['out_of_stock', 'unavailable', 'sold_out'].includes(String(product.inventory_status || '').toLowerCase())) throw new Error('A cart item is out of stock.');
    if (!Number.isInteger(product.amount) || product.amount < 50 || product.currency !== 'cad') throw new Error('A cart item has invalid pricing.');
    if (product.tax_behavior !== 'non_taxable') throw new Error('Tax must be confirmed before checkout. Please request a quote.');
    resolved.push({ product, quantity: item.quantity });
  }
  return resolved;
}

async function createCheckoutSession(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (/^sk_live_/i.test(process.env.STRIPE_SECRET_KEY || '')) return json(res, 503, { error: 'Online checkout is not available yet. Please request a quote.' });
  const stripe = getStripe();
  if (!stripe) return json(res, 503, { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY before accepting payments.' });

  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }

  let items;
  try {
    items = await resolveCheckoutItems(body.items || [{ productId: body.productId, quantity: 1 }]);
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
  const product = items[0].product;
  const total = items.reduce((sum, item) => sum + item.product.amount * item.quantity, 0);

  const customer = body.customer || {};
  const metadata = {
    product_id: product.id,
    product_category: product.category,
    product_mode: product.mode,
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
      line_items: items.map(({ product, quantity }) => ({
        quantity,
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: {
            name: product.mode === 'deposit_only' ? `${product.name} - Deposit` : product.name,
            description: product.description,
            images: product.image && product.image.startsWith('http') ? [product.image] : undefined
          }
        }
      }))
    });

    const normalized = normalizeLeadOrder({
      type: 'purchase',
      customer: customer.name,
      organization: customer.organization,
      email: customer.email,
      phone: customer.phone,
      product: items.map(({ product, quantity }) => `${product.name} x ${quantity}`).join(', '),
      category: items.length === 1 ? product.category : 'Multiple products',
      amount: total,
      status: 'checkout_started',
      notes: customer.notes,
      stripe_checkout_session_id: session.id
    });
    await saveOrderRecord(normalized);
    await syncToPulse(normalized);

    return json(res, 200, { id: session.id, url: session.url, order: normalized });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unable to create checkout session' });
  }
}

async function quoteRequest(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  if (!String(body.name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || '').trim())) {
    return json(res, 400, { error: 'Please provide your name and a valid email address.' });
  }
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
    notes: [body.message, body.deliveryPreference ? `Delivery preference: ${String(body.deliveryPreference).slice(0, 100)}` : '', body.deliveryLocation ? `Delivery location: ${String(body.deliveryLocation).slice(0, 200)}` : '', body.preferredContactMethod, body.preferredTimeline].filter(Boolean).join(' | '),
    preferred_contact_method: body.preferredContactMethod,
    preferred_timeline: body.preferredTimeline
  });
  try {
    await saveQuoteRequest(normalized);
  } catch (error) {
    console.error('[quote] Could not save request:', error.message);
    return json(res, 503, { error: 'Your request could not be saved. Please contact Soteria directly.' });
  }
  await syncToPulse(normalized);
  return json(res, 200, { ok: true, quote: normalized, emailNotification: 'not_configured' });
}

async function stripeWebhook(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const stripe = getStripe();
  if (!stripe) return json(res, 503, { error: 'Stripe is not configured' });
  if (!process.env.STRIPE_WEBHOOK_SECRET) return json(res, 503, { error: 'Webhook verification is not configured' });
  const rawBody = await readRaw(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
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
  if (pathname === '/api/quote-request') return quoteRequest(req, res);
  if (pathname === '/api/stripe-webhook') return stripeWebhook(req, res);
  return false;
}

module.exports = { handleApi, createCheckoutSession, resolveCheckoutItems, quoteRequest, stripeWebhook, productsHandler };
