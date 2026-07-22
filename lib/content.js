const { createClient } = require('@supabase/supabase-js');
const { PRODUCTS } = require('./products');

const DEFAULT_SETTINGS = {
  public_site_mode: process.env.PUBLIC_SITE_MODE || 'coming_soon',
  company_name: 'Soteria Services',
  company_email: process.env.COMPANY_EMAIL || 'info@soteriaservices.net',
  company_phone: process.env.COMPANY_PHONE || '',
  company_logo_url: '',
  logo_url: '',
  primary_cta_text: 'Request a Quote',
  primary_cta_url: '/request-quote'
};

const DEFAULT_CONTENT = [
  { slug: 'home', title: 'Soteria Services', summary: 'Start a purchase, pay a deposit, request a quote, or book a discovery call for practical safety and preparedness services.', body: 'Simple commerce and quote workflows for the services Soteria is ready to sell.', sort_order: 10 },
  { slug: 'why-soteria', title: 'Why Soteria?', summary: 'Soteria Services exists because emergency preparedness should never be an afterthought. We help organizations protect their people, reduce risk, and build confidence through practical training, safety programs, medical readiness, and emergency preparedness solutions.', body: 'Preparedness should be clear, useful, and grounded in real-world response needs.', sort_order: 20 },
  { slug: 'first-aid-training', title: 'First Aid Training', summary: 'First Aid Training Chatham-Kent and CPR Training Chatham-Kent for workplaces, teams, and organizations.', body: 'First Aid and CPR training options for organizations preparing their teams.', sort_order: 30 },
  { slug: 'aed-sales-programs', title: 'AED Sales & Programs', summary: 'AED Sales Ontario, AED Programs for Businesses, first aid kits, and AED readiness support.', body: 'AED sales, program setup, supplies, and readiness support for workplaces and organizations.', sort_order: 40 },
  { slug: 'event-medical-services', title: 'Event Medical Services', summary: 'Professional event first aid and medical standby coverage for community events, workplace events, festivals, private events, sporting events, training events, and public gatherings.', body: 'Event first aid coverage, medical standby, incident documentation, AED availability, first aid station setup, planning, and post-event summaries.', sort_order: 50 },
  { slug: 'mask-fit-testing', title: 'Mask Fit Testing', summary: 'Qualitative respirator fit testing for workplaces, healthcare-adjacent settings, industrial clients, emergency services, construction, and organizations requiring respiratory protection.', body: 'Mask fit testing appointments, group bookings, workplace sessions, documentation, and annual or periodic testing support.', sort_order: 60 },
  { slug: 'contact-cta', title: 'Contact Soteria Services', summary: 'Request a quote, start a purchase, pay a deposit, or book a discovery call.', body: 'Soteria Services will follow up to confirm details, scheduling, and next steps.', sort_order: 70 }
];

function demoContentEnabled() {
  return process.env.ENABLE_DEMO_CONTENT === 'true' || (process.env.NODE_ENV !== 'production' && process.env.PUBLIC_SITE_MODE === 'demo');
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  });
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

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}

function supabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

function adminClient() {
  const url = supabaseUrl();
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function publicClient() {
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function requesterClient(req) {
  const serviceRoleClient = adminClient();
  if (serviceRoleClient) return serviceRoleClient;
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();
  const authHeader = req.headers.authorization || '';
  if (!url || !anonKey || !authHeader.startsWith('Bearer ')) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
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
    image: product.image || product.image_url || '',
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
  if (!supabase) {
    console.warn('[settings:load] Supabase client unavailable; returning runtime defaults.');
    return DEFAULT_SETTINGS;
  }
  const { data, error } = await supabase.from('site_settings').select('key,value');
  if (error || !Array.isArray(data)) {
    console.error('[settings:load] site_settings query failed.', error || new Error('site_settings did not return a list'));
    return demoContentEnabled() ? DEFAULT_SETTINGS : {};
  }
  const settings = demoContentEnabled() ? { ...DEFAULT_SETTINGS } : {};
  for (const row of data) if (row && row.key) settings[row.key] = row.value;
  console.info('[settings:load] Loaded site settings.', {
    rowCount: data.length,
    logo_url: settings.logo_url || '',
    company_logo_url: settings.company_logo_url || ''
  });
  return settings;
}

async function getProductList(supabase, includeDisabled = false) {
  if (!supabase) return demoContentEnabled() ? PRODUCTS.map(publicProduct).filter((product) => product.enabled) : [];
  const { data, error } = await supabase
    .from('products')
    .select('id,category,name,description,amount,currency,tax_behavior,inventory_status,image_url,mode,enabled')
    .order('updated_at', { ascending: false });
  if (error || !Array.isArray(data)) {
    if (includeDisabled) throw new Error(error ? error.message : 'Products query did not return a list');
    return demoContentEnabled() ? PRODUCTS.map(publicProduct).filter((product) => product.enabled) : [];
  }
  const products = data.map(publicProduct);
  return includeDisabled ? products : products.filter((product) => product.enabled);
}

function publicContent(section) {
  return {
    slug: section.slug,
    title: section.title || '',
    summary: section.summary || '',
    body: section.body || '',
    enabled: section.enabled !== false,
    sort_order: Number(section.sort_order) || 0
  };
}

async function getContentList(supabase, includeDisabled = false) {
  const defaults = DEFAULT_CONTENT.map(publicContent);
  if (!supabase) return defaults;
  const { data, error } = await supabase
    .from('services')
    .select('slug,title,summary,body,enabled,sort_order')
    .order('sort_order', { ascending: true });
  if (error || !Array.isArray(data)) {
    if (includeDisabled) throw new Error(error ? error.message : 'Content query did not return a list');
    return defaults;
  }
  const bySlug = new Map(defaults.map((section) => [section.slug, section]));
  for (const row of data.map(publicContent)) {
    if (includeDisabled || row.enabled) bySlug.set(row.slug, row);
  }
  return Array.from(bySlug.values()).sort((a, b) => a.sort_order - b.sort_order);
}

async function getProductById(id) {
  const supabase = adminClient() || publicClient();
  const products = await getProductList(supabase);
  return products.find((product) => product.id === id && product.enabled);
}

async function publicSettingsHandler(req, res) {
  const settings = await getSettings(adminClient() || publicClient());
  return json(res, 200, { settings });
}

async function productsHandler(req, res) {
  const products = await getProductList(adminClient() || publicClient());
  return json(res, 200, { products, publishableKeyConfigured: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY) });
}

async function contentHandler(req, res) {
  const content = await getContentList(adminClient() || publicClient());
  return json(res, 200, { content });
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
    image_url: String(input.image || input.image_url || '').trim(),
    mode: ['buy_now', 'request_quote', 'deposit_only', 'inquiry_only'].includes(input.mode) ? input.mode : 'request_quote',
    enabled: input.enabled === true || input.enabled === 'true'
  };
}

async function upsertProductHandler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  if (req.method === 'GET') return json(res, 200, { products: await getProductList(supabase, true) });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const product = productPayload(body);
  if (!product.id || !product.name) return json(res, 400, { error: 'Product name is required' });
  const { data, error } = await supabase.from('products').upsert(product, { onConflict: 'id' }).select().single();
  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { product: publicProduct(data) });
}

async function archiveProductHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.' });
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
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  const { data: quotes } = await supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(100);
  return json(res, 200, { orders: orders || [], quoteRequests: quotes || [] });
}

function contentPayload(input, index) {
  const slug = String(input.slug || '').trim();
  return {
    id: slug,
    slug,
    title: String(input.title || '').trim(),
    summary: String(input.summary || '').trim(),
    body: String(input.body || '').trim(),
    image_url: String(input.image_url || '').trim(),
    enabled: input.enabled === false || input.enabled === 'false' ? false : true,
    sort_order: Number(input.sort_order) || (index + 1) * 10
  };
}

async function adminContentHandler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  if (req.method === 'GET') return json(res, 200, { content: await getContentList(supabase, true) });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const submitted = Array.isArray(body.content) ? body.content : [];
  const rows = submitted.map(contentPayload).filter((section) => section.slug && section.title);
  if (!rows.length) return json(res, 400, { error: 'No content sections were submitted' });
  const { error } = await supabase.from('services').upsert(rows, { onConflict: 'id' });
  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { content: await getContentList(supabase, true) });
}

async function updateSettingsHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Supabase content storage is not configured. Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const allowed = auth.profile.role === 'administrator'
    ? ['public_site_mode', 'company_name', 'company_email', 'company_phone', 'company_logo_url', 'logo_url', 'primary_cta_text', 'primary_cta_url']
    : ['company_name', 'company_email', 'company_phone', 'company_logo_url', 'logo_url', 'primary_cta_text', 'primary_cta_url'];
  const rows = allowed
    .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
    .map((key) => ({ key, value: String(body[key] ?? '') }));
  if (!rows.length) return json(res, 400, { error: 'No settings were submitted' });
  console.info('[settings:save] Saving site settings.', {
    keys: rows.map((row) => row.key),
    logo_url: body.logo_url || '',
    company_logo_url: body.company_logo_url || ''
  });
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) {
    console.error('[settings:save] site_settings upsert failed.', error);
    return json(res, 400, { error: error.message });
  }
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
  if (pathname === '/api/content') return contentHandler(req, res);
  if (pathname === '/api/admin/products') return upsertProductHandler(req, res);
  if (pathname === '/api/admin/products/archive') return archiveProductHandler(req, res);
  if (pathname === '/api/admin/orders') return adminOrdersHandler(req, res);
  if (pathname === '/api/admin/site-settings') return updateSettingsHandler(req, res);
  if (pathname === '/api/admin/content') return adminContentHandler(req, res);
  return false;
}

module.exports = {
  handleContentApi,
  publicSettingsHandler,
  updateSettingsHandler,
  adminContentHandler,
  contentHandler,
  upsertProductHandler,
  archiveProductHandler,
  adminOrdersHandler,
  productsHandler,
  getProductById,
  saveQuoteRequest,
  saveOrderRecord,
  getSettings,
  getContentList,
  DEFAULT_CONTENT,
  DEFAULT_SETTINGS
};
