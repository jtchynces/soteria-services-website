const fs = require('fs');
const vm = require('vm');
const required = [
  'index.html',
  'styles.css',
  'app.js',
  'server.js',
  'robots.txt',
  'sitemap.xml',
  '.env.example',
  'assets/soteria-logo.svg',
  'assets/favicon.svg',
  'config/aed-configurator.json',
  'lib/products.js',
  'lib/pulse.js',
  'lib/commerce.js',
  'lib/auth.js',
  'lib/content.js',
  'api/index.js',
  'supabase/migrations/001_auth_profiles_roles.sql',
  'supabase/migrations/002_prelaunch_content_storage.sql',
  'supabase/migrations/003_storage_image_uploads.sql'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error('Missing required launch file: ' + file);
}
for (const file of ['app.js','server.js','lib/products.js','lib/pulse.js','lib/commerce.js','api/index.js','lib/auth.js','lib/content.js']) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
}
const apiSource = fs.readFileSync('api/index.js', 'utf8');
for (const route of ['/api/auth-config','/api/invite-user','/api/site-settings','/api/content','/api/products','/api/admin/products','/api/admin/products/archive','/api/admin/content','/api/admin/site-settings','/api/admin/orders','/api/create-checkout-session','/api/stripe-webhook','/api/quote-request']) {
  if (!apiSource.includes(route)) throw new Error(`API dispatcher missing route ${route}.`);
}
const appSource = fs.readFileSync('app.js', 'utf8');
if (appSource.includes('action="/admin/products"')) {
  throw new Error('Admin products page route must not be used as a product save endpoint.');
}
if (!appSource.includes("fetch('/api/admin/products'")) {
  throw new Error('Product saves must use the /api/admin/products endpoint.');
}
if (!appSource.includes("'Authorization':'Bearer '+activeSession.access_token")) {
  throw new Error('Product admin requests must include the active Supabase access token.');
}
if (!appSource.includes('async function requireAdminSession()')) {
  throw new Error('Admin product UI must validate the current Supabase session before saving.');
}
if (!appSource.includes("'/admin/products':adminProducts")) {
  throw new Error('/admin/products must render the admin products page.');
}
if (!appSource.includes("'/admin/content':adminContent")) {
  throw new Error('/admin/content must render the admin content page.');
}
if (!appSource.includes("'/aed-configurator':aedConfigurator")) {
  throw new Error('/aed-configurator must render the AED configurator.');
}
if (!appSource.includes('ProductProvider')) {
  throw new Error('AED configurator must use a product provider abstraction.');
}
const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
if (!rewrites.some((rewrite) => rewrite.source === '/api/(.*)' && rewrite.destination === '/api?path=$1')) {
  throw new Error('Vercel API rewrite must route all API paths through api/index.js.');
}
const catchesAdminRoute = (route) => rewrites.some((rewrite) =>
  rewrite.destination === '/index.html' &&
  (rewrite.source === route || rewrite.source === '/admin/(.*)' || rewrite.source === '/admin/:path*')
);
for (const route of ['/admin/products', '/admin/settings', '/admin/orders']) {
  if (!catchesAdminRoute(route)) {
    throw new Error(`Vercel rewrite fallback missing for ${route}.`);
  }
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.dependencies || !pkg.dependencies.stripe) throw new Error('Stripe package dependency is missing');
if (!pkg.dependencies['@supabase/supabase-js']) throw new Error('Supabase package dependency is missing');
console.log('Launch build validation passed.');

