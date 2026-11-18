const fs = require('fs');
const path = require('path');
const { compatibleModels, exclusiveGroup, partsOf } = require('./aed-sheet-compatibility');

let cached;
function load() {
  if (cached) return cached;
  const file = path.join(__dirname, '../config/sos-catalogue.json');
  cached = JSON.parse(fs.readFileSync(file, 'utf8'));
  return cached;
}

function checkoutEnabled() {
  return process.env.ENABLE_STRIPE_SANDBOX_CHECKOUT === 'true' && /^sk_test_/i.test(process.env.STRIPE_SECRET_KEY || '');
}

function publicPriced(product, id) {
  const purchasable = checkoutEnabled() && product.inventory_status === 'in_stock' && Number(product.amount) >= 50;
  const part = partsOf({ ...product, id: id || product.id })[0] || product.part_number || '';
  return {
    id: id || product.id,
    category: product.category,
    name: product.name,
    description: product.description || '',
    amount: Number(product.amount) || 0,
    currency: 'cad',
    tax_behavior: 'confirm_manually',
    inventory_status: product.inventory_status || 'availability_unknown',
    image: product.image || '',
    image_url: product.image || '',
    mode: purchasable ? 'buy_now' : 'request_quote',
    enabled: product.enabled !== false,
    price_verified: Number(product.amount) > 0,
    checkout_verified: purchasable,
    fulfillment_verified: purchasable,
    shipping_verified: purchasable,
    checkout_before_tax_confirmation: purchasable,
    brand: product.brand || '',
    model: product.model || '',
    part_number: product.part_number || part,
    stock_label: product.stock_label || '',
    catalogue: product.catalogue || '',
    family: product.family || '',
    category_id: product.category_id || '',
    shippable: product.shippable !== false,
    installation_group: product.installation_group || '',
    shipping: product.shipping || {},
    specs: product.specs || [],
    compatible_models: compatibleModels(product),
    exclusive_group: exclusiveGroup(product)
  };
}

const aliasByPart = {
  'ZOLL AED 3': 'sos-zoll-aed-3',
  'ZOLL AED PLUS': 'sos-zoll-aed-plus',
  'DCF-100': 'sos-defibtech-lifeline',
  'DCF-E2310CA': 'sos-lifeline-view',
  'DDP-2001': 'sos-lifeline-view-adult-pads',
  '8000-000696': 'sos-zoll-aed-3-battery'
};

function pricedProducts() {
  return load().products.map((product) => {
    const key = String(product.part_number || '').toUpperCase().replace(/\s+/g, ' ').trim().split('(')[0].trim();
    return publicPriced(product, aliasByPart[key] || product.id);
  });
}

const costKeys = ['cost', 'cost_cents', 'cost_basis', 'distributor_cost', 'owner_cost', 'internal_cost', 'margin'];

function withoutCosts(product) {
  const copy = { ...product };
  for (const key of costKeys) delete copy[key];
  return copy;
}

function mergeDatabaseCatalogue(dbProducts) {
  const merged = (Array.isArray(dbProducts) ? dbProducts : []).map((product) => withoutCosts({ ...product }));
  const index = new Map(merged.map((product) => [product.id, product]));
  for (const priced of pricedProducts()) {
    const file = withoutCosts(priced);
    const existing = index.get(file.id);
    if (!existing) {
      merged.push(file);
      index.set(file.id, file);
      continue;
    }
    if (!(Number(existing.amount) > 0)) {
      existing.amount = file.amount;
      existing.price_verified = file.price_verified;
    }
    if (!String(existing.name || '').trim()) existing.name = file.name;
    const image = file.image || file.image_url || '';
    if (image) {
      existing.image = image;
      existing.image_url = image;
    }
    if (file.part_number) existing.part_number = file.part_number;
    if (file.stock_label) existing.stock_label = file.stock_label;
  }
  return merged;
}

function mergePreview(baseProducts) {
  const merged = baseProducts.map((product) => ({ ...product }));
  const index = new Map(merged.map((product) => [product.id, product]));
  for (const priced of pricedProducts()) {
    const existing = index.get(priced.id);
    if (!existing) {
      merged.push(priced);
      index.set(priced.id, priced);
      continue;
    }
    existing.amount = priced.amount;
    existing.price_verified = priced.price_verified;
    existing.image = priced.image || existing.image;
    existing.image_url = priced.image || existing.image_url || '';
    existing.part_number = priced.part_number;
    existing.stock_label = priced.stock_label;
    existing.brand = priced.brand;
    existing.shipping = priced.shipping;
    existing.compatible_models = priced.compatible_models;
    existing.exclusive_group = priced.exclusive_group;
    existing.installation_group = priced.installation_group;
    existing.shippable = priced.shippable;
    existing.description = existing.description || priced.description;
    if (priced.mode === 'buy_now') {
      existing.mode = 'buy_now';
      existing.checkout_verified = true;
      existing.fulfillment_verified = true;
      existing.shipping_verified = true;
      existing.checkout_before_tax_confirmation = true;
    }
  }
  return merged;
}

module.exports = { pricedProducts, mergePreview, mergeDatabaseCatalogue, load };
