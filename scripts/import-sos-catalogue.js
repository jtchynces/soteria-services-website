#!/usr/bin/env node
/**
 * Rebuild the Soteria SOS catalogue from the distributor workbooks and the
 * public sostor.com Shopify catalogue.
 *
 *   node scripts/import-sos-catalogue.js
 *   node scripts/import-sos-catalogue.js --refresh-shopify
 *
 * Writes:
 *   config/sos-catalogue.json          public products (no owner cost)
 *   data/catalogue/import-report.json  image, stock, and exclusion notes (no costs)
 *   data/internal/sos-costs.json       owner/distributor costs (gitignored)
 *   data/internal/product-costs.sql    Supabase cost upserts (gitignored)
 *   supabase/migrations/005_sos_catalogue.sql
 *
 * The GitHub repo is public. Do not commit data/internal or the source workbooks.
 * AED and Prestan selling prices come from the spreadsheets (MAP / Canadian MSRP).
 * Other SOS products use the sostor.com price. Oxygen products are excluded.
 * Prestan prices are expected to change on 1 Jan 2027. SOS prices can change
 * without notice. Re-run this script when a new workbook or Shopify pull arrives.
 */

const fs = require('fs');
const path = require('path');
const { readXlsx } = require('./xlsx-read');

const root = path.join(__dirname, '..');
const args = new Set(process.argv.slice(2));
const aedPath = argValue('--aed') || path.join(root, 'data/source/aed.xlsx');
const prestanPath = argValue('--prestan') || path.join(root, 'data/source/prestan.xlsx');
const cachePath = path.join(root, 'data/cache/sostor-products.json');

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

function moneyToCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.round(n * 1000) / 10);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanPart(raw) {
  return String(raw || '').replace(/\s+/g, ' ').replace(/\s+(Suggested Retail|Pricing)\s*$/i, '').trim();
}

function matchGroups(part) {
  return String(part || '').split(/\s+or\s+/i).map((entry) => {
    const cleaned = cleanPart(entry);
    const beforeParen = cleaned.split('(')[0].trim();
    return [...new Set([cleaned, beforeParen].filter(Boolean))];
  }).filter((group) => group.length);
}

function significantTokens(part) {
  return String(part || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(/\s+/).filter((token) => token.length >= 3 && !['WITH', 'CASE', 'SETS', 'SET', 'AND', 'THE', 'OPT', 'SPARE', 'PADS', 'PAD'].includes(token));
}

function skuKeys(value) {
  const spaced = String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (!spaced) return [];
  return [...new Set([spaced, spaced.replace(/\s+/g, '')])];
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPrices(text) {
  return String(text || '')
    .replace(/\$\s?\d[\d,]*(?:\.\d{2})?/g, '')
    .replace(/\b\d+\.\d{2}\s*(?:CAD|USD)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagsOf(product) {
  if (Array.isArray(product.tags)) return product.tags.map((tag) => String(tag));
  if (typeof product.tags === 'string') return product.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function blobOf(product) {
  return [product.title, product.product_type, product.handle, product.vendor, tagsOf(product).join(' ')].join(' ').toLowerCase();
}

function isOxygen(product) {
  const blob = blobOf(product);
  // Delivery equipment and the SOS oxygen program. Do not treat pulse oximeters,
  // or a passing use of the word "oxygen" in other descriptions, as oxygen products.
  return /\boxygen\b|\bo2\b|oxy-gen|emergency oxygen/.test(blob);
}

function isPrestan(product) {
  const vendor = String(product.vendor || '');
  const type = String(product.product_type || '');
  const title = String(product.title || '');
  return /prestan/i.test(vendor) || /prestan/i.test(type) || /^prestan\b/i.test(title);
}

function looksLikeAed(product) {
  if (isPrestan(product)) return false;
  const blob = blobOf(product);
  if (/\btrainer\b/.test(blob) && !/\b(zoll|philips|defibtech|mediana|heartsine|stryker|cardiac)\b/.test(blob)) return false;
  return /\baed\b|defibrillator/.test(blob);
}

const BRAND_FAMILIES = [
  ['defibtech'],
  ['mediana'],
  ['zoll'],
  ['stryker', 'heartsine'],
  ['philips', 'heartstream', 'heartstart'],
  ['cardiac', 'powerheart'],
  ['prestan']
];

function contradictsBrand(brand, title) {
  const haystack = String(title || '').toLowerCase();
  const needle = String(brand || '').toLowerCase();
  if (!needle || !haystack) return false;
  const family = BRAND_FAMILIES.find((names) => names.some((name) => needle.includes(name)));
  if (!family) return false;
  if (family.some((name) => haystack.includes(name))) return false;
  return BRAND_FAMILIES.some((names) => names !== family && names.some((name) => haystack.includes(name)));
}

function imageFrom(product, variant) {
  const featured = variant && variant.featured_image;
  if (featured && featured.src) return featured.src;
  const images = product.images || [];
  if (images[0] && images[0].src) return images[0].src;
  return '';
}

function parseDimensions(raw) {
  const text = String(raw || '').trim();
  const shipping = { dimensions_raw: text, weight_lbs: null, length_in: null, width_in: null, height_in: null, weight_kg: null, length_cm: null, width_cm: null, height_cm: null };
  const match = text.match(/([\d.]+)\s*"?\s*x\s*([\d.]+)\s*"?\s*x\s*([\d.]+)/i);
  if (!match || /^n\/?a$/i.test(text)) return shipping;
  const length = Number(match[1]);
  const width = Number(match[2]);
  const height = Number(match[3]);
  if ([length, width, height].every(Number.isFinite)) {
    shipping.length_in = length;
    shipping.width_in = width;
    shipping.height_in = height;
    shipping.length_cm = round3(length * 2.54);
    shipping.width_cm = round3(width * 2.54);
    shipping.height_cm = round3(height * 2.54);
  }
  return shipping;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function withWeight(shipping, pounds) {
  const weight = Number(pounds);
  if (!Number.isFinite(weight)) return shipping;
  shipping.weight_lbs = weight;
  shipping.weight_kg = round3(weight * 0.45359237);
  return shipping;
}

function prestanCategory(description) {
  const head = String(description || '').split(';')[0];
  const h = head.toLowerCase();
  if (h.includes('carry bag')) return ['prestan-bags', 'Prestan Bags & Cases'];
  if (/\btake2\b|family pack/.test(h)) return ['prestan-kits', 'Prestan Training Kits'];
  if (/aed trainer|ultratrainer/.test(h) && !/\bremote\b|language module|dongle|cable|replacement|\bstorage\b/.test(h)) {
    return ['prestan-aed-trainers', 'Prestan AED Trainers'];
  }
  const part = /lung|replacement|\bassembly\b|upgrade|\bclicker\b|\bmonitor\b|\bpiston\b|\bshirt\b|\baccessory\b|\bcable\b|skin replacement|torso skin|face skin|\bfoam\b|\bplate\b|\bframe\b|diaper|ear pin|ventilation/;
  if (/\bmanikins?\b/.test(h) && !part.test(h)) return ['prestan-manikins', 'Prestan Manikins'];
  if (/lung|face-shield|face shield/.test(h)) return ['prestan-lungs', 'Prestan Lungs & Face Shields'];
  if (/practice shield|rescue mask|face mask|adaptor|adapter/.test(h)) return ['prestan-shields', 'Prestan Face Shields & Masks'];
  if (/aed trainer|ultratrainer|training pad/.test(h)) return ['prestan-aed-trainer-parts', 'Prestan AED Trainer Parts'];
  return ['prestan-parts', 'Prestan Parts & Replacements'];
}

function aedKind(item) {
  return /battery|\bpads?\b|pad\/|carry bag|pedi-pads|pedi pads/i.test(item) ? 'accessory' : 'device';
}

function aedModel(brand, item, part, sectionNote) {
  const text = `${item} ${part} ${sectionNote || ''}`;
  if (brand === 'Defibtech' && /lifeline/i.test(text)) return 'Lifeline';
  if (brand === 'Defibtech' && /view/i.test(text)) return 'View';
  if (brand === 'Mediana') return 'HeartOn A16';
  if (brand === 'Zoll' && /aed plus/i.test(text)) return 'AED Plus';
  if (brand === 'Zoll' && /aed 3|zoll 3/i.test(text)) return 'AED 3';
  if (/heartsine/i.test(text)) return 'HeartSine';
  if (brand === 'Stryker' && /cr2/i.test(text)) return 'CR2';
  if (brand === 'Philips' && /frx/i.test(text)) return 'HeartStart FRx';
  if (brand === 'Philips' && /onsite/i.test(text)) return 'HeartStart OnSite';
  if (brand === 'Philips' && /heartstream/i.test(sectionNote || '')) return 'Heartstream';
  if (/g5/i.test(text)) return 'Powerheart G5';
  if (sectionNote === 'G3' || /\b9131\b|\b9146\b/.test(part)) return 'Powerheart G3';
  return '';
}

function deviceInStock(brand, model, item) {
  if (aedKind(item) !== 'device') return false;
  if (brand === 'Zoll' && (model === 'AED Plus' || model === 'AED 3')) return true;
  if (brand === 'Defibtech' && (model === 'Lifeline' || model === 'View')) return true;
  if (brand === 'Mediana' && model === 'HeartOn A16') return true;
  return false;
}

const IN_STOCK_NOTE = 'In stock as of 28 Aug 2026 (Zoll AED Plus, Zoll AED 3, Defibtech Lifeline and View, and the Mediana HeartOn A16). Package and basic configurations of those models are included. Pads, batteries, cases, and every other brand stay call-to-order.';

function loadAedRows() {
  const rows = readXlsx(aedPath);
  const products = [];
  let brand = '';
  for (const rowNumber of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(rowNumber);
    const item = String(row[3] || '').trim();
    const part = cleanPart(row[4]);
    const price = row[5];
    const note = String(row[7] || '').replace(/\s+/g, ' ').trim();
    const label = String(row[1] || row[2] || '').trim();
    if (label && !item) {
      const key = label.toLowerCase();
      const brands = { defibtech: 'Defibtech', mediana: 'Mediana', zoll: 'Zoll', stryker: 'Stryker', philips: 'Philips', 'cardiac science': 'Cardiac Science' };
      if (brands[key]) brand = brands[key];
    }
    if (label && item) {
      const key = label.toLowerCase();
      const brands = { defibtech: 'Defibtech', mediana: 'Mediana', zoll: 'Zoll', stryker: 'Stryker', philips: 'Philips', heartstream: 'Philips', 'cardiac science': 'Cardiac Science', g3: 'Cardiac Science' };
      if (brands[key]) brand = brands[key];
    }
    if (!item || !part || price == null || price === '' || /shipping\/tax|subject to change|only sell/i.test(part)) continue;
    const amount = moneyToCents(price);
    const cost = moneyToCents(row[6]);
    if (amount == null || cost == null) continue;
    const sectionNote = label && !/defibtech|mediana|zoll|stryker|philips|cardiac science/i.test(label) ? label : '';
    const model = aedModel(brand, item, part, sectionNote);
    const displayBrand = /heartsine/i.test(item) ? 'HeartSine' : brand || 'AED';
    const kind = aedKind(item);
    const inStock = deviceInStock(displayBrand === 'HeartSine' ? 'Stryker' : brand, model, item);
    const tidyItem = (item.match(/\)/g) || []).length > (item.match(/\(/g) || []).length ? item.replace(/\)\s*$/, '').trim() : item;
    const name = tidyItem.toLowerCase().startsWith(displayBrand.toLowerCase()) ? tidyItem : `${displayBrand} ${tidyItem}`;
    const specs = [`Part ${part}`];
    if (model) specs.push(`Model: ${model}`);
    if (note) specs.push(note);
    products.push({
      id: `sos-aed-${slug(part)}`,
      catalogue: 'aed',
      family: 'aed',
      category: kind === 'device' ? 'AED Devices' : /battery|\bpads?\b|pad\/|pedi/i.test(item) ? 'AED Pads & Batteries' : 'AED Accessories',
      category_id: kind === 'device' ? 'aed-devices' : /battery|\bpads?\b|pad\/|pedi/i.test(item) ? 'aed-pads-batteries' : 'aed-accessories',
      brand: displayBrand,
      model,
      name,
      part_number: part,
      match_groups: matchGroups(part),
      description: [name + '.', note].filter(Boolean).join(' '),
      specs,
      amount,
      currency: 'cad',
      tax_behavior: 'confirm_manually',
      inventory_status: inStock ? 'in_stock' : 'availability_unknown',
      stock_label: inStock ? 'In stock' : 'Availability unknown — call to order',
      image: '',
      image_matched: false,
      mode: 'buy_now',
      enabled: true,
      shippable: true,
      installation_group: kind === 'device' ? 'aed' : '',
      shipping: {},
      price_unlisted: false,
      sheet_note: note,
      cost_cents: cost,
      cost_basis: 'sos_june_2026_distributor_sheet'
    });
  }
  return products;
}

function loadPrestanRows() {
  const rows = readXlsx(prestanPath);
  const products = [];
  for (const rowNumber of [...rows.keys()].sort((a, b) => a - b)) {
    if (rowNumber < 6) continue;
    const row = rows.get(rowNumber);
    const part = cleanPart(row[1]);
    const description = String(row[2] || '').replace(/\s+/g, ' ').trim();
    if (!part || !description || part === 'Item') continue;
    const amount = moneyToCents(row[3]);
    const cost = moneyToCents(row[6]);
    if (amount == null || cost == null) continue;
    const [categoryId, category] = prestanCategory(description);
    const shipping = withWeight(parseDimensions(row[4]), row[5]);
    products.push({
      id: `sos-prestan-${slug(part)}`,
      catalogue: 'prestan',
      family: 'prestan',
      category,
      category_id: categoryId,
      brand: 'Prestan',
      model: '',
      name: description.split(';')[0].trim(),
      part_number: part,
      match_groups: matchGroups(part),
      description,
      specs: [`Part ${part}`, description.split(';')[0].trim()],
      amount,
      currency: 'cad',
      tax_behavior: 'confirm_manually',
      inventory_status: 'availability_unknown',
      stock_label: 'Availability unknown — call to order',
      image: '',
      image_matched: false,
      mode: 'buy_now',
      enabled: true,
      shippable: true,
      installation_group: '',
      shipping,
      price_unlisted: false,
      cost_cents: cost,
      cost_basis: 'prestan_2025_distributor_price'
    });
  }
  return products;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchShopify() {
  if (!args.has('--refresh-shopify') && fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
  const products = [];
  for (let page = 1; page < 20; page += 1) {
    if (page > 1) await sleep(500);
    const url = `https://www.sostor.com/products.json?limit=250&page=${page}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SoteriaServicesCatalogue/1.0 (authorized SOS image and price import for soteriaservices.net)', Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`sostor.com products.json page ${page} returned ${response.status}`);
    const body = await response.json();
    const batch = Array.isArray(body.products) ? body.products : [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(products));
  return products;
}

function indexShopify(shopifyProducts) {
  const index = new Map();
  for (const product of shopifyProducts) {
    for (const variant of product.variants || []) {
      for (const key of skuKeys(variant.sku)) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push({ product, variant, image: imageFrom(product, variant) });
      }
    }
  }
  return index;
}

function exactHits(part, skuIndex) {
  const hits = skuKeys(part).flatMap((key) => skuIndex.get(key) || []);
  const unique = [];
  const seen = new Set();
  for (const hit of hits) {
    const id = `${hit.product.id}:${hit.variant.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(hit);
  }
  return unique;
}

function tokenPriceHits(part, amount, skuIndex) {
  const tokens = significantTokens(part);
  if (tokens.length < 2) return [];
  const hits = [];
  const seen = new Set();
  for (const list of skuIndex.values()) {
    for (const hit of list) {
      const sku = String(hit.variant.sku || '').toUpperCase();
      if (!tokens.every((token) => sku.includes(token))) continue;
      if (moneyToCents(hit.variant.price) !== amount) continue;
      const id = `${hit.product.id}:${hit.variant.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      hits.push(hit);
    }
  }
  return hits;
}

function applyImages(sheetProducts, skuIndex, report) {
  for (const product of sheetProducts) {
    const matches = [];
    for (const group of product.match_groups || []) {
      let hits = [];
      let how = '';
      for (const part of group) {
        const found = exactHits(part, skuIndex);
        if (found.length) {
          hits = found;
          how = 'exact SKU';
          break;
        }
      }
      if (!hits.length) {
        const found = tokenPriceHits(group[0], product.amount, skuIndex);
        if (found.length === 1) {
          hits = found;
          how = 'SKU tokens plus identical listed price';
        }
      }
      matches.push({ group, hits, how });
    }
    const allHit = matches.every((entry) => entry.hits.length === 1);
    const anyHit = matches.some((entry) => entry.hits.length > 0);
    if (!allHit) {
      if (anyHit) {
        report.image_placeholders.push({
          part_number: product.part_number,
          name: product.name,
          reason: 'SKU matched only part of a combined line, or more than one Shopify variant shared the SKU.'
        });
      } else {
        report.image_placeholders.push({ part_number: product.part_number, name: product.name, reason: 'No exact Shopify SKU match.' });
      }
      continue;
    }
    const chosen = matches.map((entry) => entry.hits[0]);
    if (chosen.some((hit) => contradictsBrand(product.brand, hit.product.title))) {
      report.image_placeholders.push({
        part_number: product.part_number,
        name: product.name,
        reason: `SKU matched ${chosen.map((hit) => hit.product.title).join(' / ')}, but the Shopify title looks like a different brand.`
      });
      report.stock_comparisons.push(...stockNotes(product, chosen));
      continue;
    }
    const images = [...new Set(chosen.map((hit) => hit.image).filter(Boolean))];
    if (images.length !== 1) {
      report.image_placeholders.push({
        part_number: product.part_number,
        name: product.name,
        reason: images.length === 0 ? 'SKU matched but Shopify had no image.' : 'Combined part numbers pointed at different images.'
      });
    } else {
      product.image = images[0];
      product.image_matched = true;
      const excerpt = stripPrices(stripHtml(chosen[0].product.body_html)).slice(0, 500);
      if (excerpt && !product.description.includes(excerpt.slice(0, 40))) {
        product.specs = product.specs.concat([excerpt]);
      }
    }
    report.stock_comparisons.push(...stockNotes(product, chosen));
    report.price_comparisons.push({
      part_number: product.part_number,
      name: product.name,
      displayed_cents: product.amount,
      sostor_price: chosen.map((hit) => hit.variant.price).join(' / ')
    });
  }
}

function stockNotes(product, hits) {
  return hits.map((hit) => ({
    part_number: product.part_number,
    name: product.name,
    our_label: product.stock_label,
    sostor_sku: hit.variant.sku || '',
    sostor_available: hit.variant.available === true,
    sostor_title: hit.product.title
  })).filter((entry) => {
    const weSayInStock = product.inventory_status === 'in_stock';
    return weSayInStock !== entry.sostor_available;
  });
}

function webCategory(product) {
  const type = String(product.product_type || '').toLowerCase();
  const title = String(product.title || '').toLowerCase();
  const tags = tagsOf(product).join(' ').toLowerCase();
  const blob = `${type} ${title} ${tags}`;
  if (type === 'training' || /first aid course|cpr course|bls|instructor course|recertification/.test(title)) {
    return { category: 'Supplier training courses (SOS)', category_id: 'sos-training-courses', family: 'sos-courses', installation_group: '', shippableDefault: false };
  }
  if (type.includes('kit') || /first aid kit/.test(title)) {
    return { category: 'First aid kits', category_id: 'sos-first-aid-kits', family: 'sos-supplies', installation_group: 'first_aid_kit', shippableDefault: true };
  }
  if (type === 'gloves' || /\bgloves?\b|nitrile|\bgown\b|coverall|respirator|\bn95\b|safety glasses|protective eyewear|\bppe\b/.test(blob)) {
    return { category: 'PPE', category_id: 'sos-ppe', family: 'sos-supplies', installation_group: '', shippableDefault: true };
  }
  return { category: 'Workplace first aid supplies', category_id: 'sos-workplace-supplies', family: 'sos-supplies', installation_group: '', shippableDefault: true };
}

function addWebProducts(shopifyProducts, sheetKeys, report) {
  const products = [];
  const seen = new Set();
  for (const product of shopifyProducts) {
    if (isOxygen(product)) {
      report.excluded_oxygen.push({ title: product.title, handle: product.handle, type: product.product_type || '' });
      continue;
    }
    const variants = product.variants || [];
    const unmatched = variants.filter((variant) => !skuKeys(variant.sku).some((key) => sheetKeys.has(key)));
    if (!unmatched.length) continue;
    if (isPrestan(product)) {
      report.skipped_prestan_not_on_sheet.push({ title: product.title, handle: product.handle, skus: unmatched.map((variant) => variant.sku || '').filter(Boolean) });
      continue;
    }
    if (looksLikeAed(product)) {
      report.skipped_aed_without_map.push({ title: product.title, handle: product.handle, type: product.product_type || '', skus: unmatched.map((variant) => variant.sku || '').filter(Boolean), sostor_prices: unmatched.map((variant) => variant.price) });
      continue;
    }
    const category = webCategory(product);
    for (const variant of unmatched) {
      const part = cleanPart(variant.sku || '');
      const key = part ? skuKeys(part)[0] : `variant-${variant.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const amount = moneyToCents(variant.price);
      const unlisted = amount == null || amount <= 0;
      const option = variant.title && variant.title !== 'Default Title' ? ` — ${variant.title}` : '';
      const description = stripPrices(stripHtml(product.body_html)).slice(0, 700) || product.title;
      const image = imageFrom(product, variant);
      const shippable = variant.requires_shipping !== false && category.shippableDefault !== false ? true : variant.requires_shipping === true;
      const record = {
        id: `sos-web-${slug(part || product.handle + '-' + variant.id)}`,
        catalogue: 'sos',
        family: category.family,
        category: category.category,
        category_id: category.category_id,
        brand: String(product.vendor || 'SOS').trim(),
        model: '',
        name: `${product.title}${option}`.trim(),
        part_number: part,
        description,
        product_type: String(product.product_type || '').trim(),
        specs: [part ? `Part ${part}` : '', product.product_type ? `Type: ${product.product_type}` : ''].filter(Boolean),
        amount: unlisted ? 0 : amount,
        currency: 'cad',
        tax_behavior: 'confirm_manually',
        inventory_status: 'availability_unknown',
        stock_label: 'Availability unknown — call to order',
        image: image || '',
        image_matched: Boolean(image),
        mode: unlisted ? 'request_quote' : 'buy_now',
        enabled: true,
        shippable,
        installation_group: category.installation_group,
        shipping: withWeight(parseDimensions(''), (Number(variant.grams) || 0) / 453.59237),
        price_unlisted: unlisted,
        cost_cents: unlisted ? 0 : Math.round(amount * 0.75),
        cost_basis: '75_percent_of_sostor_listed_price'
      };
      if (!image) {
        report.image_placeholders.push({ part_number: part || product.handle, name: record.name, reason: 'SOS listing had no image.' });
      }
      if (variant.available === true || variant.available === false) {
        report.stock_comparisons.push({
          part_number: part || product.handle,
          name: record.name,
          our_label: record.stock_label,
          sostor_sku: part,
          sostor_available: variant.available === true,
          sostor_title: product.title
        });
      }
      if (unlisted) report.unlisted_prices.push({ name: record.name, handle: product.handle, sku: part });
      products.push(record);
    }
  }
  return products;
}

function publicProduct(product) {
  const copy = { ...product };
  delete copy.cost_cents;
  delete copy.cost_basis;
  delete copy.match_groups;
  delete copy.sheet_note;
  return copy;
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function writeMigration(products) {
  const lines = [];
  lines.push('-- SOS / Prestan catalogue. Public selling prices only.');
  lines.push('-- Owner and distributor costs are NOT in this file. Apply data/internal/product-costs.sql');
  lines.push('-- from a machine that has the price workbooks. Do not commit that file.');
  lines.push('');
  lines.push('alter table public.products add column if not exists brand text not null default \'\';');
  lines.push('alter table public.products add column if not exists model text not null default \'\';');
  lines.push('alter table public.products add column if not exists part_number text not null default \'\';');
  lines.push('alter table public.products add column if not exists catalogue text not null default \'\';');
  lines.push('alter table public.products add column if not exists category_id text not null default \'\';');
  lines.push('alter table public.products add column if not exists family text not null default \'\';');
  lines.push('alter table public.products add column if not exists stock_label text not null default \'\';');
  lines.push('alter table public.products add column if not exists specs jsonb not null default \'[]\'::jsonb;');
  lines.push('alter table public.products add column if not exists shipping jsonb not null default \'{}\'::jsonb;');
  lines.push('alter table public.products add column if not exists installation_group text not null default \'\';');
  lines.push('alter table public.products add column if not exists shippable boolean not null default true;');
  lines.push('');
  lines.push('create table if not exists public.product_costs (');
  lines.push('  product_id text primary key references public.products(id) on delete cascade,');
  lines.push('  cost_cents integer not null check (cost_cents >= 0),');
  lines.push('  currency text not null default \'cad\',');
  lines.push('  basis text not null default \'\',');
  lines.push('  updated_at timestamptz not null default now()');
  lines.push(');');
  lines.push('alter table public.product_costs enable row level security;');
  lines.push('drop policy if exists "Editors can read product costs" on public.product_costs;');
  lines.push('drop policy if exists "Editors can manage product costs" on public.product_costs;');
  lines.push('create policy "Editors can read product costs" on public.product_costs for select to authenticated using (public.current_user_role() in (\'administrator\', \'editor\'));');
  lines.push('create policy "Editors can manage product costs" on public.product_costs for all to authenticated using (public.current_user_role() in (\'administrator\', \'editor\')) with check (public.current_user_role() in (\'administrator\', \'editor\'));');
  lines.push('');
  for (const product of products) {
    const pub = publicProduct(product);
    lines.push(`insert into public.products (id, category, name, description, amount, currency, tax_behavior, inventory_status, image_url, mode, enabled, brand, model, part_number, catalogue, category_id, family, stock_label, specs, shipping, installation_group, shippable) values (${[
      pub.id, pub.category, pub.name, pub.description, String(pub.amount), pub.currency, pub.tax_behavior, pub.inventory_status, pub.image || '/assets/product-placeholder.svg', pub.mode, pub.enabled ? 'true' : 'false', pub.brand, pub.model, pub.part_number, pub.catalogue, pub.category_id, pub.family, pub.stock_label
    ].map((value, index) => index === 4 || index === 10 ? value : sqlString(value)).join(', ')}, ${sqlString(JSON.stringify(pub.specs))}::jsonb, ${sqlString(JSON.stringify(pub.shipping || {}))}::jsonb, ${sqlString(pub.installation_group || '')}, ${pub.shippable ? 'true' : 'false'}) on conflict (id) do nothing;`);
  }
  lines.push('');
  const target = path.join(root, 'supabase/migrations/005_sos_catalogue.sql');
  fs.writeFileSync(target, lines.join('\n'));
}

function writeCosts(products) {
  const costs = {};
  const sql = ['-- Owner-only cost upserts. Gitignored. Do not commit.', 'begin;'];
  for (const product of products) {
    costs[product.id] = { cost_cents: product.cost_cents, currency: 'cad', basis: product.cost_basis, part_number: product.part_number };
    sql.push(`insert into public.product_costs (product_id, cost_cents, currency, basis) values (${sqlString(product.id)}, ${Number(product.cost_cents) || 0}, 'cad', ${sqlString(product.cost_basis)}) on conflict (product_id) do update set cost_cents = excluded.cost_cents, basis = excluded.basis, updated_at = now();`);
  }
  sql.push('commit;');
  const dir = path.join(root, 'data/internal');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'sos-costs.json'), JSON.stringify(costs, null, 2));
  fs.writeFileSync(path.join(dir, 'product-costs.sql'), sql.join('\n'));
}

function assertNoPublicCosts(products) {
  const serialized = JSON.stringify(products.map(publicProduct));
  if (/"cost_cents"|"cost_basis"|distributor/i.test(serialized)) {
    throw new Error('Public catalogue serialization contains cost fields.');
  }
}

async function main() {
  if (!fs.existsSync(aedPath) || !fs.existsSync(prestanPath)) {
    throw new Error('Place aed.xlsx and prestan.xlsx in data/source or pass --aed and --prestan.');
  }
  const aeds = loadAedRows();
  const prestans = loadPrestanRows();
  if (aeds.length !== 41) throw new Error(`Expected 41 AED rows, found ${aeds.length}`);
  if (prestans.length !== 242) throw new Error(`Expected 242 Prestan rows, found ${prestans.length}`);
  const shopifyProducts = await fetchShopify();
  const skuIndex = indexShopify(shopifyProducts);
  const report = {
    generated_at: new Date().toISOString(),
    in_stock_policy: IN_STOCK_NOTE,
    image_placeholders: [],
    stock_disagreements: [],
    stock_comparisons: [],
    price_comparisons: [],
    excluded_oxygen: [],
    skipped_aed_without_map: [],
    skipped_prestan_not_on_sheet: [],
    unlisted_prices: [],
    supplier_training_courses: []
  };
  applyImages(aeds.concat(prestans), skuIndex, report);
  const sheetKeys = new Set();
  for (const product of aeds.concat(prestans)) {
    for (const group of product.match_groups || []) group.forEach((part) => skuKeys(part).forEach((key) => sheetKeys.add(key)));
  }
  const web = addWebProducts(shopifyProducts, sheetKeys, report);
  report.stock_disagreements = report.stock_comparisons;
  delete report.stock_comparisons;
  const all = aeds.concat(prestans, web);
  const ids = new Set();
  for (const product of all) {
    if (ids.has(product.id)) throw new Error(`Duplicate product id ${product.id}`);
    ids.add(product.id);
    if (isOxygen({ title: product.name, product_type: product.category, handle: product.part_number, vendor: product.brand, tags: [] })) {
      throw new Error(`Oxygen product was not excluded: ${product.name}`);
    }
  }
  assertNoPublicCosts(all);
  report.counts = {
    aed: aeds.length,
    prestan: prestans.length,
    sos_web: web.length,
    total: all.length,
    images_matched: all.filter((product) => product.image_matched).length,
    placeholders: report.image_placeholders.length,
    in_stock: all.filter((product) => product.inventory_status === 'in_stock').length,
    supplier_courses: web.filter((product) => product.category_id === 'sos-training-courses').length,
    kits: web.filter((product) => product.category_id === 'sos-first-aid-kits').length,
    ppe: web.filter((product) => product.category_id === 'sos-ppe').length,
    workplace_supplies: web.filter((product) => product.category_id === 'sos-workplace-supplies').length,
    oxygen_excluded: report.excluded_oxygen.length,
    aed_skipped: report.skipped_aed_without_map.length,
    prestan_skipped: report.skipped_prestan_not_on_sheet.length
  };
  report.supplier_training_courses = web.filter((product) => product.category_id === 'sos-training-courses').map((product) => ({ name: product.name, part_number: product.part_number, amount: product.amount }));
  report.soteria_course_overlap = report.supplier_training_courses.filter((course) => /first aid|cpr|responder/i.test(course.name));
  report.categories = [...new Map(all.map((product) => [product.category_id, { id: product.category_id, label: product.category, family: product.family }])).values()];
  const publicCatalogue = {
    version: 1,
    generated_at: report.generated_at,
    currency: 'cad',
    country: 'CA',
    pricing_notes: {
      aed: 'Displayed price is the SOS June 2026 MAP.',
      prestan: 'Displayed price is the 2025 Canadian MSRP and MAP.',
      sos: 'Displayed price is the price listed on sostor.com.'
    },
    in_stock_policy: IN_STOCK_NOTE,
    categories: report.categories,
    products: all.map(publicProduct)
  };
  fs.mkdirSync(path.join(root, 'data/catalogue'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config/sos-catalogue.json'), JSON.stringify(publicCatalogue));
  fs.writeFileSync(path.join(root, 'data/catalogue/import-report.json'), JSON.stringify(report, null, 2));
  writeCosts(all);
  writeMigration(all.map(publicProduct));
  console.log(JSON.stringify(report.counts, null, 2));
  console.log(`Shopify products scanned: ${shopifyProducts.length}`);
  console.log(`Placeholders: ${report.image_placeholders.length}`);
  console.log(`Stock disagreements: ${report.stock_disagreements.length}`);
  console.log(`Oxygen excluded: ${report.excluded_oxygen.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
