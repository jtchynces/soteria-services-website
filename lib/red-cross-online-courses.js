const fs = require('fs');
const path = require('path');

const courses = [
  ['crc-online-dogs-cats', 'First Aid for Dogs & Cats', 'English & French'],
  ['crc-online-opioid', 'First Aid for Opioid Poisoning', 'English & French'],
  ['crc-online-pfa-self-care', 'Psychological First Aid – Self-Care', 'English & French'],
  ['crc-online-pfa-caring', 'Psychological First Aid – Caring for Others', 'English & French'],
  ['crc-online-whmis-2015', 'WHMIS 2015', 'English & French'],
  ['crc-online-bloodborne', 'Bloodborne Pathogens', 'English & French'],
  ['crc-online-bear-travelling', 'Bear Aware: Travelling in Bear Country', 'English & French'],
  ['crc-online-bear-working', 'Bear Aware: Working in Bear Country', 'English & French'],
  ['crc-online-confined', 'Confined Space Awareness', 'English & French'],
  ['crc-online-ppe', 'Personal Protective Equipment (PPE) Awareness', 'English & French'],
  ['crc-online-fire', 'Fire Safety', 'English & French'],
  ['crc-online-lockout', 'Lockout/Tagout', 'English & French'],
  ['crc-online-medical-terminology', 'Medical Terminology', 'English only'],
  ['crc-online-h2s', 'H2S Awareness', 'English only'],
  ['crc-online-tdg', 'Transportation of Dangerous Goods', 'English only'],
  ['crc-online-tdg-energy', 'Transportation of Dangerous Goods – Energy Services', 'English only']
];

function priceFile() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/red-cross-online-courses.json'), 'utf8'));
}

function publicCourses() {
  const prices = priceFile().prices_cents || {};
  return courses.map(([id, name, language]) => {
    const amount = prices[id];
    if (!Number.isInteger(amount) || amount < 50) throw new Error('Missing sell price for ' + id);
    return {
      id,
      category: 'Online Courses',
      subcategory: 'Canadian Red Cross',
      tag: 'Canadian Red Cross',
      name,
      language,
      description: 'Offered by Soteria Services as an authorized reseller. Language: ' + language + '.',
      amount,
      currency: 'cad',
      tax_behavior: 'confirm_manually',
      inventory_status: 'quote_required',
      image: '',
      image_url: '',
      mode: 'request_quote',
      enabled: true,
      price_verified: true,
      checkout_verified: false,
      fulfillment_verified: false,
      shipping_verified: false,
      checkout_before_tax_confirmation: false,
      shippable: false
    };
  });
}

function isRedCrossCourse(product) {
  return !!(product && product.category === 'Online Courses' && product.tag === 'Canadian Red Cross');
}

module.exports = { publicCourses, isRedCrossCourse, priceFile };
