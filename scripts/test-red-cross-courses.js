const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const config = JSON.parse(fs.readFileSync('config/red-cross-online-courses.json', 'utf8'));
const sections = require('../catalogue-sections');
const { publicCourses } = require('../lib/red-cross-online-courses');
const { resolveQuoteCart, describeQuoteCart } = require('../lib/commerce');

function keys(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const key of Object.keys(value)) {
    found.push(key);
    keys(value[key], found);
  }
  return found;
}

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;
delete process.env.ENABLE_DEMO_CONTENT;
delete process.env.SOS_CATALOG_PREVIEW;
process.env.NODE_ENV = 'production';
const { getProductList } = require('../lib/content');

const expected = [
  ['crc-online-dogs-cats', 'First Aid for Dogs & Cats', 'English & French', 3000],
  ['crc-online-opioid', 'First Aid for Opioid Poisoning', 'English & French', 3000],
  ['crc-online-pfa-self-care', 'Psychological First Aid – Self-Care', 'English & French', 2000],
  ['crc-online-pfa-caring', 'Psychological First Aid – Caring for Others', 'English & French', 2000],
  ['crc-online-whmis-2015', 'WHMIS 2015', 'English & French', 3795],
  ['crc-online-bloodborne', 'Bloodborne Pathogens', 'English & French', 3495],
  ['crc-online-bear-travelling', 'Bear Aware: Travelling in Bear Country', 'English & French', 1995],
  ['crc-online-bear-working', 'Bear Aware: Working in Bear Country', 'English & French', 1995],
  ['crc-online-confined', 'Confined Space Awareness', 'English & French', 2495],
  ['crc-online-ppe', 'Personal Protective Equipment (PPE) Awareness', 'English & French', 2495],
  ['crc-online-fire', 'Fire Safety', 'English & French', 2495],
  ['crc-online-lockout', 'Lockout/Tagout', 'English & French', 2495],
  ['crc-online-medical-terminology', 'Medical Terminology', 'English only', 28000],
  ['crc-online-h2s', 'H2S Awareness', 'English only', 2495],
  ['crc-online-tdg', 'Transportation of Dangerous Goods', 'English only', 3495],
  ['crc-online-tdg-energy', 'Transportation of Dangerous Goods – Energy Services', 'English only', 3495]
];

assert.deepEqual(Object.keys(config).sort(), ['currency', 'prices_cents']);
assert.equal(config.currency, 'cad');
assert.equal(Object.keys(config.prices_cents).length, 16);
assert.equal(config.note, undefined);
assert.ok(!keys(config).some((key) => /cost|tp|pending/i.test(key)));
assert.ok(!JSON.stringify(config).includes('PENDING'));
for (const [id, , , amount] of expected) assert.equal(config.prices_cents[id], amount);

const courses = publicCourses();
assert.equal(courses.length, 16);
for (const [id, name, language, amount] of expected) {
  const course = courses.find((item) => item.id === id);
  assert.equal(course.name, name);
  assert.equal(course.language, language);
  assert.equal(course.amount, config.prices_cents[id]);
  assert.equal(course.amount, amount);
  assert.equal(course.category, 'Online Courses');
  assert.equal(course.tag, 'Canadian Red Cross');
  assert.equal(course.subcategory, 'Canadian Red Cross');
  assert.equal(course.mode, 'request_quote');
  assert.equal(course.checkout_verified, false);
  assert.equal(course.image, '');
  assert.equal(course.cost, undefined);
  assert.equal(course.cost_cents, undefined);
  assert.equal(course.tp, undefined);
  assert.equal(course.tp_cents, undefined);
  assert.equal(sections.isTrainingProduct(course), false);
  assert.equal(sections.isAedPageProduct(course), false);
  assert.equal(sections.isEquipmentProduct(course), false);
}
assert.ok(!JSON.stringify(courses).match(/cost_cents|cost_basis|"tp"|tp_cents|distributor/));

const db = { from: () => ({ select: () => ({ order: async () => ({ data: [{ id: 'crc-online-whmis-2015', category: 'First Aid Training', name: 'Wrong name', amount: 1, enabled: false, cost_cents: 50, tp_cents: 9 }], error: null }) }) }) };
(async () => {
  process.env.SOS_PRICED_CATALOGUE = 'true';
  const merged = await getProductList(db);
  const listed = merged.filter((product) => product.tag === 'Canadian Red Cross');
  assert.equal(listed.length, 16);
  const whmis = listed.find((product) => product.id === 'crc-online-whmis-2015');
  assert.equal(whmis.amount, config.prices_cents['crc-online-whmis-2015']);
  assert.equal(whmis.name, 'WHMIS 2015');
  assert.equal(whmis.enabled, true);
  assert.equal(whmis.cost_cents, undefined);
  assert.equal(whmis.tp_cents, undefined);
  assert.ok(listed.every((product) => !sections.isTrainingProduct(product) && !sections.isAedPageProduct(product) && !sections.isEquipmentProduct(product)));
  delete process.env.SOS_PRICED_CATALOGUE;
  assert.equal((await getProductList(db)).some((product) => product.tag === 'Canadian Red Cross'), false);

  const lookup = async (id) => courses.find((course) => course.id === id);
  await assert.rejects(resolveQuoteCart({ items: [{ productId: courses[0].id, quantity: 2, participants: [{ name: 'A', email: 'a@valid.ca' }] }], services: [] }, lookup), /each course seat/);
  const quote = await resolveQuoteCart({ items: [{ productId: courses[0].id, quantity: 1, participants: [{ name: 'Pat Example', email: 'pat@valid.ca' }] }], services: [] }, lookup);
  const notes = describeQuoteCart(quote);
  assert.match(notes, /First Aid for Dogs & Cats \[crc-online-dogs-cats\] x 1 \(Pat Example <pat@valid\.ca>\)/);
  assert.match(notes, /Online courses are non-refundable/);
  assert.doesNotMatch(notes, /cost|tp_cents/i);

  const listeners = {};
  const context = {
    document: { addEventListener() {} },
    hero: (title) => '<h1>' + title + '</h1>',
    esc: (value) => String(value || ''),
    products: () => courses,
    productPath: (product) => '/products/' + product.id,
    money: (cents) => (cents / 100).toFixed(2),
    productCard: (product) => product.name
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('catalogue-sections.js', 'utf8') + '\n' + fs.readFileSync('expansion.js', 'utf8') + '\nthis.routes = expansionRoutes;', context);
  const online = context.routes['/online-courses']();
  assert.match(online, /Canadian Red Cross Online Courses/);
  assert.match(online, /offered by Soteria Services as an authorized reseller/);
  assert.match(online, /Online courses are non-refundable/);
  assert.match(online, /After purchase, you'll receive an email with instructions to log in to your course/);
  assert.doesNotMatch(online, /<img/);
  for (const [, name, language, amount] of expected) {
    assert.match(online, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(online, new RegExp(language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(online, new RegExp((amount / 100).toFixed(2)));
  }
  const trainingPage = context.routes['/courses']();
  for (const [, name] of expected) assert.doesNotMatch(trainingPage, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const cat = JSON.parse(fs.readFileSync('config/sos-catalogue.json', 'utf8'));
  const supplier = cat.products.filter((product) => product.category === 'Supplier training courses (SOS)');
  assert.equal(supplier.length, 10);
  assert.ok(supplier.every((product) => !sections.isTrainingProduct(product) && !sections.isAedPageProduct(product) && !sections.isEquipmentProduct(product)));
  const detailSource = fs.readFileSync('app.js', 'utf8');
  assert.match(detailSource, /After purchase, you\\'ll receive an email with instructions to log in to your course/);
  assert.match(fs.readFileSync('quote-cart.js', 'utf8'), /Online courses are non-refundable/);
  assert.match(fs.readFileSync('index.html', 'utf8'), /href="\/online-courses" data-link>Online Courses/);
  assert.match(fs.readFileSync('index.html', 'utf8'), /href="\/courses" data-link>Training/);
  for (const file of ['app.js', 'expansion.js', 'quote-cart.js', 'catalogue-sections.js']) {
    assert.equal(fs.readFileSync(file, 'utf8').includes('prices_cents'), false);
  }
  console.log('Red Cross online course count: 16');
  console.log('Red Cross online course checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
