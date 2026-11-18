const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
const definitions = ['function productPriceMarkup(', 'function productCard(', 'function productDetail('].map(prefix => {
  const line = source.find(item => item.startsWith(prefix));
  assert.ok(line, `Missing ${prefix}`);
  return line;
}).join('\n');
const quoteProduct = { id: 'aed-1', name: 'AED', category: 'AED Sales', description: 'An AED', amount: 0, mode: 'request_quote' };
const context = {
  esc: value => String(value || '').replace(/[&<>"']/g, ''),
  money: cents => '$' + (cents / 100).toFixed(2),
  brandLogo: () => '',
  productPath: product => '/products/' + product.id,
  quoteUrl: product => '/request-quote?product=' + product.id,
  route: () => '/products/aed-1',
  products: () => [quoteProduct],
  hero: (name, description) => '<h1>' + name + '</h1><p>' + description + '</p>'
};
vm.createContext(context);
vm.runInContext(definitions + '\nthis.renderCard = productCard; this.renderDetail = productDetail;', context);
for (const html of [context.renderCard(quoteProduct), context.renderDetail()]) {
  assert.match(html, /Price on request/);
  assert.match(html, /Request a Quote/);
  assert.match(html, /Image unavailable/);
  assert.doesNotMatch(html, /\$0\.00|data-cart-add|data-checkout/);
}
const unverified = context.renderCard({ ...quoteProduct, amount: 200000, mode: 'buy_now' });
assert.match(unverified, /Price on request/);
assert.doesNotMatch(unverified, /data-cart-add|data-checkout|\$2000\.00/);
const buyHtml = context.renderCard({ ...quoteProduct, amount: 200000, mode: 'buy_now', price_verified:true, checkout_verified:true });
assert.match(buyHtml, /\$2000\.00/);
assert.match(buyHtml, /data-quote-add/);
assert.match(context.renderCard({ ...quoteProduct, image:'https://valid.test/image.png' }), /https:\/\/valid\.test\/image\.png/);
console.log('Quote catalog rendering checks passed.');
