const { createClient } = require('@supabase/supabase-js');

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

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function configHandler(req, res) {
  return json(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    configured: Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY))
  });
}

async function inviteUserHandler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const admin = getSupabaseAdmin();
  if (!admin) return json(res, 503, { error: 'Supabase admin invite is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });

  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'Invalid JSON body' }); }
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const role = body.role === 'administrator' ? 'administrator' : 'editor';
  if (!email) return json(res, 400, { error: 'Email is required' });
  if (!bearerToken) return json(res, 401, { error: 'Missing Supabase access token' });

  const { data: requesterData, error: requesterError } = await admin.auth.getUser(bearerToken);
  if (requesterError || !requesterData.user) return json(res, 401, { error: 'Invalid Supabase access token' });

  const { data: requesterProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', requesterData.user.id)
    .single();
  if (profileError || requesterProfile.role !== 'administrator') {
    return json(res, 403, { error: 'Only administrators can invite users' });
  }

  const redirectTo = `${process.env.SITE_URL || 'http://localhost:3000'}/admin`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, role }
  });
  if (error) return json(res, 400, { error: error.message });

  if (data && data.user) {
    await admin.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role
    });
  }

  return json(res, 200, { ok: true, email, role });
}

async function handleAuthApi(req, res, pathname) {
  if (pathname === '/api/auth-config') return configHandler(req, res);
  if (pathname === '/api/invite-user') return inviteUserHandler(req, res);
  return false;
}

module.exports = { handleAuthApi, configHandler, inviteUserHandler };
