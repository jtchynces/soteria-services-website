const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const listeners = {};
const context = {
  document: { addEventListener(name, callback) { listeners[name] = callback; } },
  hero: (title, description) => `<h1>${title}</h1><p>${description}</p>`,
  esc: value => String(value).replace(/[&<>"']/g, ''),
  products: () => [],
  location: { search: '' },
  URLSearchParams,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('expansion.js', 'utf8') + '\nthis.routes = expansionRoutes; this.metadata = expansionSeo;', context);
for (const path of ['/remote-medical-services', '/emergency-management', '/health-safety', '/corporate-training', '/medical-coverage-request', '/about', '/shop-equipment', '/courses']) {
  assert.equal(typeof context.routes[path], 'function');
  assert.ok(context.metadata[path][0]);
  assert.match(context.routes[path](), /<h1>/);
}
assert.match(context.routes['/emergency-management'](), /authorization/);
assert.match(context.routes['/medical-coverage-request'](), /evacuation arrangements/);
assert.match(context.routes['/corporate-training'](), /Certification renewal deadlines/);
assert.equal(typeof listeners.submit, 'function');
console.log('Expansion page checks passed.');
