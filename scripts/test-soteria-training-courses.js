const assert = require('node:assert/strict');
const fs = require('node:fs');
const sections = require('../catalogue-sections');
const { publicCourses } = require('../lib/soteria-training-courses');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;
delete process.env.ENABLE_DEMO_CONTENT;
delete process.env.SOS_CATALOG_PREVIEW;
delete process.env.SOS_PRICED_CATALOGUE;
process.env.NODE_ENV = 'production';
const { getProductList } = require('../lib/content');

const courses = publicCourses();
assert.equal(courses.length, 3);
for (const course of courses) {
  assert.equal(course.category, 'First Aid Training');
  assert.equal(course.amount, 0);
  assert.equal(course.price_verified, false);
  assert.equal(course.price_label, 'Contact for pricing');
  assert.equal(course.mode, 'request_quote');
  assert.equal(course.checkout_verified, false);
  assert.equal(course.tag, undefined);
  assert.equal(sections.isTrainingProduct(course), true);
  assert.equal(sections.isAedPageProduct(course), false);
  assert.equal(sections.isEquipmentProduct(course), false);
  assert.doesNotMatch(course.description, /reseller|non-refundable|log in to your course|Red Cross/i);
  assert.doesNotMatch(JSON.stringify(course), /cost_cents|cost_basis|"tp"|tp_cents/);
}
assert.deepEqual(courses.map((course) => course.id), ['soteria-course-first-responder', 'soteria-course-emr', 'soteria-course-oxygen-airways']);
assert.match(courses[0].description, /^Soteria Services First Responder course\. Contact us for dates, format and pricing\.$/);
assert.match(courses[1].description, /^Soteria Services EMR \(Emergency Medical Responder\) course\. Contact us for dates, format and pricing\.$/);
assert.match(courses[2].description, /^Soteria Services Oxygen and Airways course\. Contact us for dates, format and pricing\.$/);

const db = { from: () => ({ select: () => ({ order: async () => ({ data: [{ id: 'db-utility', category: 'First Aid Training', name: 'Athletic Standard Utility Box', amount: 0, enabled: true, mode: 'request_quote' }], error: null }) }) }) };

(async () => {
  const listed = await getProductList(db);
  const utility = listed.find((product) => product.name === 'Athletic Standard Utility Box');
  assert.equal(utility.category, 'First aid kits');
  assert.equal(sections.isTrainingProduct(utility), false);
  assert.equal(sections.isEquipmentProduct(utility), true);
  const own = listed.filter((product) => String(product.id).startsWith('soteria-course-'));
  assert.equal(own.length, 3);
  assert.ok(own.every((product) => product.price_label === 'Contact for pricing' && product.amount === 0 && sections.isTrainingProduct(product)));
  const training = listed.filter(sections.isTrainingProduct);
  assert.equal(training.length, 3);

  const html = fs.readFileSync('index.html', 'utf8');
  const top = html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)[0];
  const bottom = html.match(/<footer[\s\S]*?<nav>([\s\S]*?)<\/nav>/)[1];
  const hrefs = (block) => [...block.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs(top), ['/', '/courses', '/online-courses', '/shop-equipment', '/aed-sales-programs', '/medical-services', '/health-safety', '/about', '/contact', '/cart', '/emergency-management', '/mask-fit-testing', '/soteria-pulse']);
  assert.deepEqual(hrefs(bottom), ['/privacy-policy', '/terms-of-use', '/accessibility-statement', '/admin']);
  assert.equal(top.includes('corporate-training'), false);
  assert.equal(bottom.includes('corporate-training'), false);
  assert.match(html, /aria-controls="primary-navigation"/);
  assert.match(fs.readFileSync('styles.css', 'utf8'), /\.mobile-menu\{display:none[\s\S]*@media\(max-width:960px\)\{[\s\S]*\.mobile-menu\{display:inline-flex\}\.main-nav\{display:none[\s\S]*\.main-nav\.open\{display:flex\}/);
  assert.match(fs.readFileSync('expansion.js', 'utf8'), /'\/corporate-training'/);
  assert.match(fs.readFileSync('scripts/build-static.js', 'utf8'), /'corporate-training'/);
  console.log('Soteria training course checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
