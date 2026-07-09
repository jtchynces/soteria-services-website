const PRODUCTS = [
  {
    id: 'first-aid-training-seat',
    category: 'First Aid Training',
    name: 'First Aid / CPR Training Seat',
    description: 'Training registration payment for confirmed First Aid or CPR course seats.',
    amount: 12500,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'available',
    image: '/assets/soteria-logo.svg',
    mode: 'buy_now',
    enabled: true
  },
  {
    id: 'aed-program-deposit',
    category: 'AED Sales',
    name: 'AED Program Deposit',
    description: 'Deposit toward an AED sales and program setup quote. Final scope is confirmed by Soteria Services.',
    amount: 25000,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'quote_required',
    image: '/assets/soteria-logo.svg',
    mode: 'deposit_only',
    enabled: true
  },
  {
    id: 'workplace-first-aid-kit',
    category: 'First Aid Kits',
    name: 'Workplace First Aid Kit',
    description: 'Workplace first aid kit order. Product selection and availability are subject to confirmation.',
    amount: 13900,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'available',
    image: '/assets/soteria-logo.svg',
    mode: 'buy_now',
    enabled: true
  },
  {
    id: 'mask-fit-testing-session',
    category: 'Mask Fit Testing',
    name: 'Mask Fit Testing Appointment',
    description: 'Qualitative respirator fit testing appointment or group booking deposit.',
    amount: 4500,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'available',
    image: '/assets/soteria-logo.svg',
    mode: 'buy_now',
    enabled: true
  },
  {
    id: 'event-medical-deposit',
    category: 'Event Medical Deposit',
    name: 'Event Medical Coverage Deposit',
    description: 'Deposit for event first aid or medical standby coverage. Soteria will confirm event details after payment.',
    amount: 30000,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'scheduled_service',
    image: '/assets/soteria-logo.svg',
    mode: 'deposit_only',
    enabled: true
  },
  {
    id: 'readiness-assessment-deposit',
    category: 'Consulting / Readiness Assessment Deposit',
    name: 'Readiness Assessment Deposit',
    description: 'Deposit for emergency preparedness consulting or readiness assessment.',
    amount: 25000,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: 'scheduled_service',
    image: '/assets/soteria-logo.svg',
    mode: 'deposit_only',
    enabled: true
  },
  {
    id: 'soteria-pulse-demo',
    category: 'Soteria Pulse Inquiry / Demo Request',
    name: 'Soteria Pulse Demo Request',
    description: 'Request a Soteria Pulse discovery call or demo. No payment required.',
    amount: 0,
    currency: 'cad',
    tax_behavior: 'non_taxable',
    inventory_status: 'coming_soon',
    image: '/assets/soteria-logo.svg',
    mode: 'coming_soon',
    enabled: true
  }
];

function getProducts() {
  return PRODUCTS.filter((product) => product.enabled);
}

function getProductById(id) {
  return PRODUCTS.find((product) => product.id === id && product.enabled);
}

function publicProduct(product) {
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    description: product.description,
    amount: product.amount,
    currency: product.currency,
    tax_behavior: product.tax_behavior,
    inventory_status: product.inventory_status,
    image: product.image,
    mode: product.mode,
    enabled: product.enabled
  };
}

module.exports = { PRODUCTS, getProducts, getProductById, publicProduct };
