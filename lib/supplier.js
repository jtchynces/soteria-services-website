const { requesterClient, requesterProfile, canEdit } = require('./content');

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function prepareObservation(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid supplier record.');
  const name = String(input.name || '').trim();
  const cents = Number(input.retail_cents);
  let url;
  try { url = new URL(String(input.supplier_url || '')); } catch { throw new Error('A valid SOS product URL is required.'); }
  if (url.protocol !== 'https:' || !['sostor.com', 'www.sostor.com'].includes(url.hostname) || !url.pathname.includes('/products/')) throw new Error('Use an SOS Technologies product URL.');
  const verified = String(input.price_verified_on || '');
  const date = new Date(verified + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verified) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== verified || date > new Date()) throw new Error('Enter a valid verification date, not in the future.');
  if (!name || name.length > 240 || input.retail_cents === '' || input.retail_cents == null || !Number.isInteger(cents) || cents < 0 || cents > 100000000) throw new Error('Name and retail price in cents are required.');
  const row = {
    supplier: 'SOS Technologies', name, supplier_url: url.href,
    manufacturer: String(input.manufacturer || '').slice(0, 120),
    model: String(input.model || '').slice(0, 120), sku: String(input.sku || '').slice(0, 120),
    category: String(input.category || '').slice(0, 120), specifications: String(input.specifications || '').slice(0, 4000),
    retail_cents: cents, cost_cents: Math.round(cents * 3 / 4), price_verified_on: verified,
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
  if (!canEdit(auth.profile)) return json(res, 403, { error: 'Not authorized' });
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
