const { configHandler, inviteUserHandler } = require('../lib/auth');
const {
  createCheckoutSession,
  productsHandler,
  quoteRequest,
  stripeWebhook
} = require('../lib/commerce');
const {
  adminContentHandler,
  adminOrdersHandler,
  archiveProductHandler,
  contentHandler,
  publicSettingsHandler,
  updateSettingsHandler,
  upsertProductHandler
} = require('../lib/content');

const routes = {
  '/api/auth-config': ['auth-config', configHandler],
  '/api/invite-user': ['invite-user', inviteUserHandler],
  '/api/site-settings': ['site-settings', publicSettingsHandler],
  '/api/content': ['content', contentHandler],
  '/api/products': ['products', productsHandler],
  '/api/admin/products': ['admin-products', upsertProductHandler],
  '/api/admin/products/archive': ['admin-products-archive', archiveProductHandler],
  '/api/admin/content': ['admin-content', adminContentHandler],
  '/api/admin/site-settings': ['admin-site-settings', updateSettingsHandler],
  '/api/admin/orders': ['admin-orders', adminOrdersHandler],
  '/api/create-checkout-session': ['create-checkout-session', createCheckoutSession],
  '/api/stripe-webhook': ['stripe-webhook', stripeWebhook],
  '/api/quote-request': ['quote-request', quoteRequest]
};

function routePath(req) {
  const url = new URL(req.url || '/api', 'https://soteriaservices.net');
  const rewrittenPath = url.searchParams.get('path');
  const raw = rewrittenPath ? '/api/' + rewrittenPath : url.pathname;
  return decodeURI(raw).replace(/\/$/, '') || '/api';
}

function jsonNotFound(res, pathname) {
  res.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  });
  res.end(JSON.stringify({ error: 'API route not found', path: pathname }));
}

module.exports = async function apiRouter(req, res) {
  const pathname = routePath(req);
  const match = routes[pathname];
  let statusCode = 404;
  const writeHead = res.writeHead.bind(res);
  res.writeHead = (status, ...args) => {
    statusCode = status;
    return writeHead(status, ...args);
  };

  console.info('[api-router] request', {
    method: req.method,
    url: req.url,
    path: pathname,
    matched: match ? match[0] : ''
  });

  try {
    if (!match) return jsonNotFound(res, pathname);
    await match[1](req, res);
  } catch (error) {
    statusCode = 500;
    console.error('[api-router] handler failed', {
      method: req.method,
      url: req.url,
      path: pathname,
      matched: match ? match[0] : '',
      error
    });
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0'
      });
      res.end(JSON.stringify({ error: 'API request failed', path: pathname }));
    }
  } finally {
    console.info('[api-router] response', {
      method: req.method,
      url: req.url,
      path: pathname,
      matched: match ? match[0] : '',
      statusCode
    });
  }
};
