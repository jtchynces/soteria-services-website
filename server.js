const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi } = require('./lib/commerce');
const { handleAuthApi } = require('./lib/auth');
const { handleContentApi, publicSettingsHandler, productsHandler } = require('./lib/content');
const { supplierReviewsHandler } = require('./lib/supplier');
const { supplierImportHandler } = require('./lib/supplier-import');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const port = process.env.PORT || 3000;
const localPreview = process.argv.includes('--local-preview');
const root = __dirname;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (['GET', 'HEAD'].includes(req.method) && ['/event-medical-services', '/remote-medical-services'].includes(url.pathname.replace(/\/$/, ''))) {
    res.writeHead(308, { Location: '/medical-services' + url.search });
    res.end();
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    if (localPreview && url.pathname === '/api/site-settings') return publicSettingsHandler(req, res, { localPreview: true });
    if (localPreview && url.pathname === '/api/products') return productsHandler(req, res, { localPreview: true });
    if (url.pathname === '/api/admin/supplier-reviews') return supplierReviewsHandler(req, res);
    if (url.pathname === '/api/admin/supplier-import') return supplierImportHandler(req, res);
    const authHandled = await handleAuthApi(req, res, url.pathname);
    if (authHandled !== false) return;
    const contentHandled = await handleContentApi(req, res, url.pathname);
    if (contentHandled !== false) return;
    const handled = await handleApi(req, res, url.pathname);
    if (handled !== false) return;
    res.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0'
    });
    res.end(JSON.stringify({ error: 'API route not found', path: url.pathname }));
    return;
  }

  const safeUrl = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const publicFiles = new Set(['index.html', 'app.js', 'expansion.js', 'supplier-admin.js', 'aed-sheet.js', 'aed-catalog.js', 'quote-cart.js', 'styles.css', 'robots.txt', 'sitemap.xml']);
  const allowedAsset = /^(assets|config)\/[a-zA-Z0-9_./-]+$/.test(safeUrl) && !safeUrl.split('/').includes('..');
  if (safeUrl && !publicFiles.has(safeUrl) && !allowedAsset && path.extname(safeUrl)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  let filePath = publicFiles.has(safeUrl) || allowedAsset ? path.join(root, safeUrl) : path.join(root, 'index.html');
  if (!filePath.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (allowedAsset) { res.writeHead(404); res.end('Not found'); return; }
    filePath = path.join(root, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, localPreview ? '127.0.0.1' : undefined, () => {
  console.log(`Soteria Services site running at http://localhost:${port}${localPreview ? ' (local preview)' : ''}`);
});
