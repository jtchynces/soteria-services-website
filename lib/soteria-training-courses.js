const courses = [
  ['soteria-course-first-responder', 'First Responder', 'Soteria Services First Responder course. Contact us for dates, format and pricing.'],
  ['soteria-course-emr', 'EMR (Emergency Medical Responder)', 'Soteria Services EMR (Emergency Medical Responder) course. Contact us for dates, format and pricing.'],
  ['soteria-course-oxygen-airways', 'Oxygen and Airways', 'Soteria Services Oxygen and Airways course. Contact us for dates, format and pricing.']
];

function publicCourses() {
  return courses.map(([id, name, description]) => ({
    id,
    category: 'First Aid Training',
    name,
    description,
    amount: 0,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'quote_required',
    image: '',
    image_url: '',
    mode: 'request_quote',
    enabled: true,
    price_verified: false,
    price_label: 'Contact for pricing',
    checkout_verified: false,
    fulfillment_verified: false,
    shipping_verified: false,
    checkout_before_tax_confirmation: false,
    shippable: false
  }));
}

module.exports = { publicCourses };
