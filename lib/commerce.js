const { productsHandler, getProductById, saveQuoteRequest, saveOrderRecord } = require('./content');
const { normalizeLeadOrder, syncToPulse } = require('./pulse');
const AedCatalog = require('../aed-catalog');
const { quoteShipping } = require('./shipping');
const { quoteInstallation } = require('./installation');
const { notifyPaidOrder } = require('./order-notification');
const { isRedCrossCourse } = require('./red-cross-online-courses');

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

function validateAedCompatibility(items) {
  const products = items.map(item => item.product);
  const aeds = products.filter(product => AedCatalog.build([product]).aeds.length);
  const accessories = products.filter(product => AedCatalog.build([product]).accessories.length);
  if (aeds.length && accessories.some(part => !aeds.some(aed => AedCatalog.compatible(aed, part)))) throw new Error('An AED accessory is not verified as compatible with any selected AED. Remove it or request it separately.');
  const groups = new Set();
  for (const part of accessories) {
    const group = AedCatalog.exclusiveGroup(part);
    if (!group) continue;
    if (groups.has(group)) throw new Error('Only one ' + group + ' selection is allowed. Remove one or choose Not sure? Request a quote.');
    groups.add(group);
  }
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
    if (product.checkout_verified !== true || product.price_verified !== true || product.fulfillment_verified !== true || product.shipping_verified !== true) throw new Error('Product price, tax, shipping and fulfillment must be verified before checkout. Please request a quote.');
    if (['out_of_stock', 'unavailable', 'sold_out'].includes(String(product.inventory_status || '').toLowerCase())) throw new Error('A cart item is out of stock.');
    if (!Number.isInteger(product.amount) || product.amount < 50 || product.currency !== 'cad') throw new Error('A cart item has invalid pricing.');
    if (product.tax_behavior !== 'non_taxable' && product.checkout_before_tax_confirmation !== true) throw new Error('Tax must be confirmed before checkout. Please request a quote.');
    resolved.push({ product, quantity: item.quantity });
  }
  validateAedCompatibility(resolved);
  return resolved;
}

async function createCheckoutSession(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (/^sk_live_/i.test(process.env.STRIPE_SECRET_KEY || '')) return json(res, 503, { error: 'Online checkout is not available yet. Please request a quote.' });
  if (process.env.ENABLE_STRIPE_SANDBOX_CHECKOUT !== 'true' || !/^sk_test_/i.test(process.env.STRIPE_SECRET_KEY || '')) return json(res, 503, { error: 'Online checkout is not available yet. Please request a quote.' });
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
  const goods = items.map(({ product, quantity }) => ({ ...product, quantity }));
  const address = body.shippingAddress || {};
  const shipping = quoteShipping(goods, { country: address.country || 'CA' });
  if (shipping.status === 'unavailable') return json(res, 400, { error: shipping.note || 'Orders ship within Canada only.' });
  if (shipping.status === 'quote_required') return json(res, 409, { error: shipping.note || 'This order needs a shipping quote before checkout.' });
  const installation = body.installationRequested ? quoteInstallation(goods, { country: address.country || 'CA', province: address.province, postal: address.postal || address.postalCode }) : { available: false, priceCents: 0 };
  if (body.installationRequested && !installation.available) return json(res, 400, { error: 'Installation is not available for this address or cart.' });
  const shipCents = shipping.status === 'priced' ? shipping.amountCents : 0;
  const installCents = installation.available ? installation.priceCents : 0;
  const total = items.reduce((sum, item) => sum + item.product.amount * item.quantity, 0) + shipCents + installCents;

  const customer = body.customer || {};
  const metadata = {
    product_id: product.id,
    product_category: product.category,
    product_mode: product.mode,
    organization: String(customer.organization || '').slice(0, 500),
    phone: String(customer.phone || '').slice(0, 100),
    notes: String(customer.notes || '').slice(0, 500),
    installation_requested: installation.available ? 'yes' : 'no',
    shipping_placeholder: shipping.placeholder ? 'true' : 'false',
    shipping_line1: String(address.line1 || '').slice(0, 200),
    shipping_city: String(address.city || '').slice(0, 100),
    shipping_province: String(address.province || '').slice(0, 40),
    shipping_postal: String(address.postal || address.postalCode || '').slice(0, 20)
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
            description: [product.part_number ? `Part ${product.part_number}` : '', product.stock_label || product.description || ''].filter(Boolean).join('. ').slice(0, 500),
            images: product.image && product.image.startsWith('http') ? [product.image] : undefined,
            metadata: { product_id: String(product.id).slice(0, 500), part_number: String(product.part_number || '').slice(0, 500) }
          }
        }
      })).concat(installation.available ? [{
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: installation.priceCents,
          product_data: {
            name: installation.label || 'Installation',
            description: installation.description || undefined,
            metadata: { product_id: 'installation-aed', part_number: '' }
          }
        }
      }] : []),
      ...(shipCents > 0 ? { shipping_address_collection: { allowed_countries: ['CA'] }, shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: shipCents, currency: 'cad' }, display_name: String(shipping.label || 'Canada shipping').slice(0, 100), metadata: { placeholder: shipping.placeholder ? 'true' : 'false' } } }] } : {})
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

async function resolveAedPackage(input, lookup = getProductById) {
  if (!input || !input.aed || !Array.isArray(input.accessories) || input.accessories.length > 30 || !Array.isArray(input.services)) throw new Error('Invalid AED package.');
  const allowedServices = ['Installation inquiry', 'Training inquiry', 'Soteria Pulse management inquiry'];
  if (input.services.length > allowedServices.length || new Set(input.services).size !== input.services.length || input.services.some(service => !allowedServices.includes(service))) throw new Error('Invalid AED service selection.');
  const seen = new Set();
  async function resolve(item, expectedType) {
    if (!item || typeof item.productId !== 'string' || seen.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Invalid AED package item or quantity.');
    seen.add(item.productId);
    const product = await lookup(item.productId);
    if (!product || product.enabled === false) throw new Error('An AED package item is no longer available.');
    const catalog = AedCatalog.build([product]);
    const result = (expectedType === 'aed' ? catalog.aeds : catalog.accessories)[0];
    if (!result) throw new Error('Invalid AED package item.');
    return { ...result, quantity: item.quantity };
  }
  const aed = await resolve(input.aed, 'aed');
  const accessories = [];
  for (const item of input.accessories) {
    const accessory = await resolve(item, 'accessory');
    if (!AedCatalog.compatible(aed, accessory)) throw new Error('An accessory is not verified as compatible with the selected AED.');
    accessories.push(accessory);
  }
  const groups = new Set();
  for (const accessory of accessories) {
    const group = accessory.exclusive_group || AedCatalog.exclusiveGroup(accessory);
    if (!group) continue;
    if (groups.has(group)) throw new Error('Only one ' + group + ' selection is allowed. Remove one or choose Not sure? Request a quote.');
    groups.add(group);
  }
  return { aed, accessories, services: input.services };
}

async function resolveQuoteCart(input, lookup = getProductById) {
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30 || !Array.isArray(input.services)) throw new Error('Choose between 1 and 30 quote items.');
  const allowedServices = ['Installation inquiry', 'Training inquiry', 'Soteria Pulse management inquiry'];
  if (input.services.length > allowedServices.length || new Set(input.services).size !== input.services.length || input.services.some(service => !allowedServices.includes(service))) throw new Error('Invalid service selection.');
  const seen = new Set(), items = [];
  for (const item of input.items) {
    if (!item || typeof item.productId !== 'string' || !item.productId || item.productId.length > 150 || seen.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Invalid quote item or quantity.');
    seen.add(item.productId);
    const product = await lookup(item.productId);
    if (!product || product.enabled === false) throw new Error('A quote item is no longer available.');
    if (isRedCrossCourse(product)) {
      if (!Array.isArray(item.participants) || item.participants.length !== item.quantity) throw new Error('Enter a name and email for each course seat.');
      const participants = item.participants.map((person) => {
        const name = String(person && person.name || '').trim();
        const email = String(person && person.email || '').trim();
        if (!name || name.length > 150 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a name and email for each course seat.');
        return { name, email };
      });
      items.push({ product, quantity: item.quantity, participants });
    } else items.push({ product, quantity: item.quantity });
  }
  validateAedCompatibility(items);
  return { items, services:input.services };
}

function describeQuoteCart(quote) {
  const details = quote.items.map(({ product, quantity, participants }) => {
    const people = Array.isArray(participants) && participants.length ? ' (' + participants.map((person) => person.name + ' <' + person.email + '>').join('; ') + ')' : '';
    return `${product.name} [${product.id}]${AedCatalog.partNumber(product) ? `, manufacturer part ${AedCatalog.partNumber(product)}` : ''} x ${quantity}${people}`;
  });
  const lines = ['Equipment quote', ...details, ...quote.services];
  if (quote.items.some((item) => isRedCrossCourse(item.product))) lines.push('Online courses are non-refundable.');
  return lines.join(' | ');
}

async function quoteRequest(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  if (!String(body.name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || '').trim())) {
    return json(res, 400, { error: 'Please provide your name and a valid email address.' });
  }
  let packageDetails = '';
  let requestId;
  if (body.quoteCart !== undefined) {
    for (const [field, limit] of Object.entries({ name:150, organization:150, email:254, phone:50, deliveryLocation:200, message:2000 })) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > limit)) return json(res, 400, { error: `Invalid ${field}.` });
    }
    if (body.aedPackage !== undefined || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.requestId || ''))) return json(res, 400, { error: 'Invalid quote request ID.' });
    requestId = body.requestId;
    try {
      const quote = await resolveQuoteCart(body.quoteCart);
      packageDetails = describeQuoteCart(quote);
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (body.aedPackage !== undefined) {
    try {
      const pack = await resolveAedPackage(body.aedPackage);
      const format = item => `${item.name} [${item.id}] x ${item.quantity} - ${item.price == null ? 'Price on request' : `CAD ${(item.price * item.quantity / 100).toFixed(2)}`}`;
      packageDetails = ['AED Configurator Quote', ...[pack.aed, ...pack.accessories].map(format), ...pack.services, 'Final total subject to quotation'].join(' | ');
    } catch (error) { return json(res, 400, { error: error.message }); }
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
    notes: [packageDetails, body.message, body.deliveryPreference ? `Delivery preference: ${String(body.deliveryPreference).slice(0, 100)}` : '', body.deliveryLocation ? `Delivery location: ${String(body.deliveryLocation).slice(0, 200)}` : '', body.preferredContactMethod, body.preferredTimeline].filter(Boolean).join(' | '),
    preferred_contact_method: body.preferredContactMethod,
    preferred_timeline: body.preferredTimeline
  });
  let saved;
  try {
    saved = await saveQuoteRequest(normalized, requestId);
  } catch (error) {
    console.error('[quote] Could not save request:', error.message);
    return json(res, 503, { error: 'Your request could not be saved. Please contact Soteria directly.' });
  }
  if (!saved?.duplicate) await syncToPulse(normalized);
  return json(res, 200, { ok: true, duplicate: !!saved?.duplicate, quote: saved?.duplicate ? undefined : normalized, emailNotification: 'not_configured' });
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

  if (event.type === 'checkout.session.completed') {
    try { await notifyPaidOrder(stripe, event); } catch (error) { console.error('[order-email] Notification failed. The webhook was still accepted.', error); }
  }

  return json(res, 200, { received: true, type: event.type, order: normalized });
}

async function installationPreview(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const ids = Array.isArray(body.productIds) ? body.productIds.slice(0, 30) : [];
  const products = [];
  for (const id of ids) {
    const product = await getProductById(id);
    if (product) products.push(product);
  }
  return json(res, 200, { installation: quoteInstallation(products, { country: 'CA', province: body.province, postal: body.postal || body.postalCode }) });
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/products') return productsHandler(req, res);
  if (pathname === '/api/installation-preview') return installationPreview(req, res);
  if (pathname === '/api/create-checkout-session') return createCheckoutSession(req, res);
  if (pathname === '/api/quote-request') return quoteRequest(req, res);
  if (pathname === '/api/stripe-webhook') return stripeWebhook(req, res);
  return false;
}

module.exports = { handleApi, createCheckoutSession, resolveCheckoutItems, resolveAedPackage, resolveQuoteCart, describeQuoteCart, quoteRequest, stripeWebhook, productsHandler, installationPreview };
