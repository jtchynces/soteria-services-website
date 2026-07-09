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
  'lib/products.js',
  'lib/pulse.js',
  'lib/commerce.js',
  'lib/auth.js',
  'lib/content.js',
  'api/create-checkout-session.js',
  'api/stripe-webhook.js',
  'api/quote-request.js',
  'api/products.js',
  'api/auth-config.js',
  'api/invite-user.js',
  'supabase/migrations/001_auth_profiles_roles.sql',
  'supabase/migrations/002_prelaunch_content_storage.sql',
  'supabase/migrations/003_storage_image_uploads.sql'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error('Missing required launch file: ' + file);
}
for (const file of ['app.js','server.js','lib/products.js','lib/pulse.js','lib/commerce.js','api/create-checkout-session.js','api/stripe-webhook.js','api/quote-request.js','api/products.js','lib/auth.js','api/auth-config.js','api/invite-user.js','lib/content.js']) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.dependencies || !pkg.dependencies.stripe) throw new Error('Stripe package dependency is missing');
if (!pkg.dependencies['@supabase/supabase-js']) throw new Error('Supabase package dependency is missing');
console.log('Launch build validation passed.');

