const { requesterClient, requesterProfile, canAdmin } = require('./content');

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function prepareObservation(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid supplier record.');
  const name = String(input.name || '').trim();
  const cents = Number(input.retail_cents);
  const method = String(input.pricing_method || 'manual_actual');
  if (!['manual_actual', 'sos_discount', 'prestan_spreadsheet', 'aed_spreadsheet'].includes(method)) throw new Error('Select a valid pricing method.');
  const spreadsheet = method === 'prestan_spreadsheet' || method === 'aed_spreadsheet';
  let supplierUrl = '';
  if (input.supplier_url) {
    let url;
    try { url = new URL(String(input.supplier_url)); } catch { throw new Error('A valid SOS product URL is required.'); }
    if (url.protocol !== 'https:' || !['sostor.com', 'www.sostor.com'].includes(url.hostname) || !url.pathname.includes('/products/')) throw new Error('Use an SOS Technologies product URL.');
    supplierUrl = url.href;
  }
  if (!spreadsheet && !supplierUrl) throw new Error('A valid SOS product URL is required.');
  const verified = String(input.price_verified_on || '');
  const date = new Date(verified + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verified) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== verified || date > new Date()) throw new Error('Enter a valid verification date, not in the future.');
  if (!name || name.length > 240 || input.retail_cents === '' || input.retail_cents == null || !Number.isInteger(cents) || cents < 0 || cents > 100000000) throw new Error('Name and retail price in cents are required.');
  const confirmed = input.discount_confirmed === true || input.discount_confirmed === 'true';
  if (method === 'sos_discount' && !confirmed) throw new Error('Confirm that the SOS discount covers this product.');
  if (method === 'sos_discount' && !['first aid supplies', 'first aid kits'].includes(String(input.category || '').trim().toLowerCase())) throw new Error('The SOS discount method is limited to eligible first aid supplies and kits.');
  const cost = method === 'sos_discount' ? Math.round(cents * 3 / 4) : Number(input.cost_cents);
  if (method !== 'sos_discount' && (input.cost_cents === '' || input.cost_cents == null || !Number.isInteger(cost) || cost < 0 || cost > 100000000)) throw new Error('Enter the actual supplier cost in cents.');
  let map = null;
  if (spreadsheet) {
    if (!String(input.source_name || '').trim() || !String(input.sku || '').trim()) throw new Error('Spreadsheet source name and item number are required.');
    map = Number(input.map_cents);
    if (input.map_cents === '' || input.map_cents == null || !Number.isInteger(map) || map < 0 || map > 100000000) throw new Error('Enter the verified MAP in cents.');
    if (cents < map) throw new Error('Retail price cannot be below MAP.');
  }
  const row = {
    supplier: 'SOS Technologies', name, supplier_url: supplierUrl,
    manufacturer: String(input.manufacturer || '').slice(0, 120),
    model: String(input.model || '').slice(0, 120), sku: String(input.sku || '').slice(0, 120),
    category: String(input.category || '').slice(0, 120), specifications: String(input.specifications || '').slice(0, 4000),
    retail_cents: cents, cost_cents: cost, price_verified_on: verified,
    pricing_method: method, source_name: String(input.source_name || '').trim().slice(0, 240), map_cents: map,
    discount_confirmed: method === 'sos_discount' && confirmed,
    tax_basis: ['before_tax', 'includes_tax'].includes(input.tax_basis) ? input.tax_basis : 'unverified',
    availability: String(input.availability || 'unverified').slice(0, 120), review_status: 'pending',
    updated_at: new Date().toISOString()
  };
  if (input.id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) throw new Error('Invalid record ID.');
    row.id = input.id;
  }
  return row;
}

async function supplierReviewsHandler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
  if (!String(req.headers.authorization || '').startsWith('Bearer ')) return json(res, 401, { error: 'Missing access token' });
  const supabase = requesterClient(req);
  if (!supabase) return json(res, 503, { error: 'Supplier storage is unavailable.' });
  const auth = await requesterProfile(req, supabase);
  if (auth.error) return json(res, 401, { error: auth.error });
  if (!canAdmin(auth.profile)) return json(res, 403, { error: 'Administrator access required.' });
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('supplier_price_reviews').select('*').order('updated_at', { ascending: false }).limit(200);
    if (error) return json(res, 500, { error: 'Supplier records could not be loaded.' });
    return json(res, 200, { records: data });
  }
  let body = '';
  try {
    for await (const chunk of req) { body += chunk; if (body.length > 300000) throw new Error('Import is too large.'); }
    const input = JSON.parse(body);
    const items = Array.isArray(input.records) ? input.records : [input];
    if (!items.length || items.length > 50) throw new Error('Import between 1 and 50 records at a time.');
    const rows = items.map(prepareObservation);
    const { data, error } = await supabase.from('supplier_price_reviews').upsert(rows).select();
    if (error) return json(res, 500, { error: 'Supplier records could not be saved.' });
    return json(res, 200, { records: data });
  } catch (error) { return json(res, 400, { error: error.message }); }
}

module.exports = { supplierReviewsHandler, prepareObservation };
