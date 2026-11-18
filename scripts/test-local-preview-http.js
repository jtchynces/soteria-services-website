const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function verify(preview) {
  const port = await unusedPort();
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'test', PUBLIC_SITE_MODE: 'coming_soon', SOS_CATALOG_PREVIEW: 'false', SOS_PRICED_CATALOGUE: '', ENABLE_DEMO_CONTENT: 'false', SUPABASE_URL: '', VITE_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_ANON_KEY: '', VITE_SUPABASE_ANON_KEY: '', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '' };
  const child = spawn(process.execPath, ['server.js', ...(preview ? ['--local-preview'] : [])], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start')), 10000);
      child.stdout.on('data', chunk => { if (String(chunk).includes('site running')) { clearTimeout(timeout); resolve(); } });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error('Server exited: ' + code)); });
    });
    const base = `http://127.0.0.1:${port}`;
    const settings = await (await fetch(base + '/api/site-settings?localPreview=true')).json();
    assert.equal(settings.settings.public_site_mode, preview ? 'live' : 'coming_soon');
    const catalog = await (await fetch(base + '/api/products')).json();
    assert.equal(catalog.products.length > 0, preview);
    if (preview) {
      assert.ok(catalog.products.some(item => item.category === 'PRESTAN Equipment'));
      assert.ok(catalog.products.every(item => item.mode === 'request_quote'));
      for (const page of ['/shop-equipment', '/courses', '/corporate-training', '/medical-services', '/emergency-management', '/health-safety', '/admin/products']) {
        const response = await fetch(base + page);
        assert.equal(response.status, 200, page);
        assert.match(await response.text(), /<main id="app">/);
      }
      for (const oldPath of ['/event-medical-services', '/remote-medical-services']) {
        const redirect = await fetch(base + oldPath + '?source=check', { redirect: 'manual' });
        assert.equal(redirect.status, 308);
        assert.equal(redirect.headers.get('location'), '/medical-services?source=check');
      }
      const admin = await fetch(base + '/api/admin/products');
      assert.notEqual(admin.status, 200);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await stopped;
    }
  }
}

(async () => {
  await verify(true);
  await verify(false);
  console.log('Local and production-style HTTP preview checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
