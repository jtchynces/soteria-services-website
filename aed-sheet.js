/**
 * Compatibility taken from the June 2026 SOS AED price sheet sections.
 * An accessory is linked only when it is listed after that model's device rows
 * and before the next device. HeartSine pad-paks and Cardiac Science G3 parts
 * are not linked: the sheet does not list a matching AED above them.
 * No cabinet parts are on the sheet, so there is no cabinet group.
 */
const groups = [
  { model: 'lifeline', deviceParts: ['DCF-E100', 'DCF-100'], accessories: [
    { part: 'DCF-200', exclusiveGroup: '' },
    { part: 'DDP-100', exclusiveGroup: 'pads' },
    { part: 'DDP-200P', exclusiveGroup: 'pads' }
  ]},
  { model: 'view', deviceParts: ['DCF-E2310PCA', 'DCF-E2310CA'], accessories: [
    { part: 'DCF-2003', exclusiveGroup: '' },
    { part: 'DDP-2001', exclusiveGroup: 'pads' },
    { part: 'DDP-2002', exclusiveGroup: 'pads' }
  ]},
  { model: 'mediana-a16', deviceParts: ['A16M'], accessories: [
    { part: 'M6098-0', exclusiveGroup: '' },
    { part: 'A0561', exclusiveGroup: 'pads' },
    { part: 'A0565', exclusiveGroup: '' }
  ]},
  { model: 'zoll-aed-plus', deviceParts: ['ZOLL AED PLUS'], accessories: [
    { part: '8000-0807-01', exclusiveGroup: '' },
    { part: '8900-0800-01', exclusiveGroup: 'pads' },
    { part: '8900-0810-01', exclusiveGroup: 'pads' }
  ]},
  { model: 'zoll-aed-3', deviceParts: ['ZOLL AED 3'], accessories: [
    { part: '8000-000696', exclusiveGroup: '' },
    { part: '8900-000280', exclusiveGroup: 'pads' }
  ]},
  { model: 'cr2', deviceParts: ['99512-000730', '99512-000732'], accessories: [
    { part: '11141-000165', exclusiveGroup: '' },
    { part: '11101-000021', exclusiveGroup: 'pads' }
  ]},
  { model: 'philips-frx', deviceParts: ['861304 R01'], accessories: [
    { part: 'M5070A', exclusiveGroup: '' },
    { part: '989803139261', exclusiveGroup: 'pads' }
  ]},
  { model: 'philips-onsite', deviceParts: ['M5066A R01', 'M5066A C01'], accessories: [
    { part: 'M5071A', exclusiveGroup: 'pads' },
    { part: 'M5072A', exclusiveGroup: 'pads' }
  ]},
  { model: 'g5', deviceParts: ['G5S-90C', 'G5A-90C'], accessories: [
    { part: 'XBTAED001A', exclusiveGroup: '' },
    { part: 'XELAED002C', exclusiveGroup: 'pads' },
    { part: 'XELAED001C', exclusiveGroup: 'pads' },
    { part: 'XELAED003C', exclusiveGroup: 'pads' }
  ]}
];

const codexPartById = {
  'sos-zoll-aed-3': ['ZOLL AED 3'],
  'sos-zoll-aed-plus': ['ZOLL AED PLUS'],
  'sos-defibtech-lifeline': ['DCF-100'],
  'sos-lifeline-view': ['DCF-E2310CA'],
  'sos-lifeline-view-adult-pads': ['DDP-2001'],
  'sos-zoll-aed-3-battery': ['8000-000696']
};

function norm(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function partsOf(product) {
  const fromId = product && codexPartById[product.id];
  const raw = [product && product.part_number].concat(fromId || []);
  const keys = new Set();
  for (const value of raw) {
    const text = norm(value);
    if (!text) continue;
    keys.add(text);
    for (const piece of text.split(/\s+OR\s+/)) keys.add(piece.trim());
    const beforeParen = text.split('(')[0].trim();
    if (beforeParen) keys.add(beforeParen);
  }
  return [...keys];
}

function accessoryRow(product) {
  const parts = new Set(partsOf(product));
  for (const group of groups) {
    const row = group.accessories.find((item) => parts.has(norm(item.part)));
    if (row) return { group, row };
  }
  return null;
}

function deviceModels(product) {
  const parts = new Set(partsOf(product));
  return groups.filter((group) => group.deviceParts.some((part) => parts.has(norm(part)))).map((group) => group.model);
}

function sheetCompatible(aed, accessory) {
  const models = new Set(deviceModels(aed));
  const match = accessoryRow(accessory);
  return !!(match && models.has(match.group.model));
}

function exclusiveGroup(product) {
  const match = accessoryRow(product);
  return match ? match.row.exclusiveGroup || '' : '';
}

function compatibleModels(product) {
  const own = deviceModels(product);
  if (own.length) return own;
  const match = accessoryRow(product);
  return match ? [match.group.model] : [];
}

const api = { groups, sheetCompatible, exclusiveGroup, compatibleModels, partsOf };
if (typeof module !== 'undefined') module.exports = api;
if (typeof window !== 'undefined') window.AedSheetCompatibility = api;
