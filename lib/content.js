const { createClient } = require('@supabase/supabase-js');
const { PRODUCTS } = require('./products');

const DEFAULT_SETTINGS = {
  public_site_mode: process.env.PUBLIC_SITE_MODE || 'coming_soon',
  company_name: 'Soteria Services',
  company_email: process.env.COMPANY_EMAIL || 'info@soteriaservices.ca',
  company_phone: process.env.COMPANY_PHONE || '',
  company_logo_url: '/assets/soteria-logo.svg',
  primary_cta_text: 'Request a Quote',
  primary_cta_url: '/request-quote'
};

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

function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function publicProduct(product) {
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    description: product.description,
    amount: Number(product.amount) || 0,
    currency: product.currency || 'cad',
    tax_behavior: product.tax_behavior || 'confirm_manually',
    inventory_status: product.inventory_status || 'available',
    image: product.image || product.image_url || '/assets/soteria-logo.svg',
    mode: product.mode || 'request_quote',
    enabled: product.enabled !== false
  };
}

async function requesterProfile(req, supabase) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { error: 'Missing access token' };
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: 'Invalid access token' };
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', userData.user.id)
    .single();
  if (profileError || !profile) return { error: 'Admin profile not found' };
  return { user: userData.user, profile };
}

function canEdit(profile) {
  return profile && ['administrator', 'editor'].includes(profile.role);
}

function canAdmin(profile) {
  return profile && profile.role === 'administrator';
}

async function getSettings(supabase) {
  if (!supabase) return DEFAULT_SETTINGS;
  const { data, error } = await supabase.from('site_settings').select('key,value');
  if (error || !Array.isArray(data)) return DEFAULT_SETTINGS;
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of data) if (row && row.key) settings[row.key] = row.value;
  return settings;
}

async function getProductList(supabase) {
  if (!supabase) return PRODUCTS.map(publicProduct).filter((product) => product.enabled);
  const { data, error } = await supabase
    .from('products')
    .select('id,category,name,description,amount,currency,tax_behavior,inventory_status,image_url,mode,enabled')
    .order('updated_at', { ascending: false });
  if (error || !Array.isArray(data) || data.length === 0) return PRODUCTS.map(publicProduct).filter((product) => product.enabled);
  return data.map(publicProduct).filter((product) => product.enabled);
}

async function getProductById(id) {
  const supabase = adminClient();
  const products = await getProductList(supabase);
  return products.find((product) => product.id === id && product.enabled);
}

async function publicSettingsHandler(req, res) {
  const settings = await getSettings(adminClient());
  return json(res, 200, { settings });
}

async function productsHandler(req, res) {
  const products = await getProductList(adminClient());
  return json(res, 200, { products, publishableKeyConfigured: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY) });
}

function productPayload(input) {
  const name = String(input.name || '').trim();
  const id = String(input.id || input.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
  return {
    id,
    category: String(input.category || 'First Aid Training').trim(),
    name,
    description: String(input.description || '').trim(),
    amount: Number(input.amount) || 0,
    currency: 'cad',
    tax_behavior: ['taxable', 'non_taxable', 'confirm_manually'].includes(input.tax_behavior) ? input.tax_behavior : 'confirm_manually',
    inventory_status: String(input.inventory_status || 'available').trim(),
    image_url: String(input.image || input.image_url || '/assets/soteria-logo.svg').trim(),
    mode: ['buy_now', 'request_quote', 'deposit_only', 'inquiry_only'].includes(input.mode) ? input.mode : 'request_quote',
    enabled: input.enabled === true || input.enabled === 'true'
  };
}

async function upsertProductHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const supabase = adminClient();
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const product = productPayload(body);
  if (!product.id || !product.name) return json(res, 400, { error: 'Product name is required' });
  const { data, error } = await supabase.from('products').upsert(product).select().single();
  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { product: publicProduct(data) });
}

async function archiveProductHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const supabase = adminClient();
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const { error } = await supabase.from('products').update({ enabled: false }).eq('id', String(body.id || ''));
  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { ok: true });
}

async function adminOrdersHandler(req, res) {
  const supabase = adminClient();
  if (!supabase) return json(res, 200, { orders: [] });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  const { data: quotes } = await supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(100);
  return json(res, 200, { orders: orders || [], quoteRequests: quotes || [] });
}

async function updateSettingsHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const supabase = adminClient();
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const allowed = auth.profile.role === 'administrator'
    ? ['public_site_mode', 'company_name', 'company_email', 'company_phone', 'company_logo_url', 'primary_cta_text', 'primary_cta_url']
    : ['company_name', 'company_email', 'company_phone', 'company_logo_url', 'primary_cta_text', 'primary_cta_url'];
  const currentSettings = await getSettings(supabase);
  const rows = allowed.map((key) => ({ key, value: String(body[key] ?? currentSettings[key] ?? DEFAULT_SETTINGS[key] ?? '') }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { settings: await getSettings(supabase) });
}

async function saveQuoteRequest(normalized) {
  const supabase = adminClient();
  if (!supabase) return;
  await supabase.from('quote_requests').insert({
    customer_name: normalized.customer,
    organization: normalized.organization,
    email: normalized.email,
    phone: normalized.phone,
    service_interest: normalized.product,
    message: normalized.notes,
    preferred_contact_method: normalized.preferred_contact_method || '',
    preferred_timeline: normalized.preferred_timeline || '',
    source: normalized.source,
    status: 'New Lead'
  });
}

async function saveOrderRecord(normalized) {
  const supabase = adminClient();
  if (!supabase) return;
  await supabase.from('orders').insert({
    customer_name: normalized.customer,
    organization: normalized.organization,
    email: normalized.email,
    phone: normalized.phone,
    product: normalized.product,
    category: normalized.category,
    amount: normalized.amount,
    payment_status: normalized.status,
    stripe_checkout_session_id: normalized.stripe_checkout_session_id || '',
    stripe_payment_intent_id: normalized.stripe_payment_intent_id || '',
    notes: normalized.notes || '',
    fulfillment_status: 'New'
  });
}

async function handleContentApi(req, res, pathname) {
  if (pathname === '/api/site-settings') return publicSettingsHandler(req, res);
  if (pathname === '/api/admin/products') return upsertProductHandler(req, res);
  if (pathname === '/api/admin/products/archive') return archiveProductHandler(req, res);
  if (pathname === '/api/admin/orders') return adminOrdersHandler(req, res);
  if (pathname === '/api/admin/site-settings') return updateSettingsHandler(req, res);
  return false;
}

module.exports = {
  handleContentApi,
  productsHandler,
  getProductById,
  saveQuoteRequest,
  saveOrderRecord,
  getSettings,
  DEFAULT_SETTINGS
};
