const { configHandler, inviteUserHandler } = require('../lib/auth');
const {
  createCheckoutSession,
  productsHandler,
  quoteRequest,
  stripeWebhook
} = require('../lib/commerce');
const { handleContentApi } = require('../lib/content');

module.exports = async function apiRouter(req, res) {
  const pathname = new URL(req.url, 'https://soteriaservices.net').pathname.replace(/\/$/, '') || '/';

  if (pathname === '/api/auth-config') return configHandler(req, res);
  if (pathname === '/api/create-checkout-session') return createCheckoutSession(req, res);
  if (pathname === '/api/invite-user') return inviteUserHandler(req, res);
  if (pathname === '/api/products') return productsHandler(req, res);
  if (pathname === '/api/quote-request') return quoteRequest(req, res);
  if (pathname === '/api/stripe-webhook') return stripeWebhook(req, res);

  const handled = await handleContentApi(req, res, pathname);
  if (handled) return;

  res.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  });
  res.end(JSON.stringify({ error: 'API route not found' }));
};
