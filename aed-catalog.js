const AedCatalog = (() => {
  // Bindings require an exact catalog identity as well as a reviewed manufacturer model.
  // Accessory parts were checked against the supplied June 2026 AED price list.
  const bindings = Object.freeze({
    'sos-zoll-aed-3': { name: 'ZOLL AED 3', model: 'ZOLL AED 3' },
    'sos-zoll-aed-plus': { name: 'ZOLL AED Plus', model: 'ZOLL AED Plus' },
    'sos-defibtech-lifeline': { name: 'Defibtech Lifeline AED', model: 'DDU-100' },
    'sos-lifeline-view': { name: 'Defibtech Lifeline View AED', model: 'DDU-2300' },
    'sos-lifeline-view-adult-pads': { name: 'Defibtech Lifeline View Adult Pads', model: 'DDP-2001', kind: 'model-specific' },
    'sos-zoll-aed-3-battery': { name: 'ZOLL AED 3 Battery Pack', model: '8000-000696', kind: 'model-specific' }
  });
  const relationships = Object.freeze([
    { device: 'ZOLL AED 3', part: '8000-000696', source: 'https://www.zoll.com/en-gb/products/accessories/by-product/aed-3' },
    { device: 'ZOLL AED Plus', part: '8900-0800-01', source: 'https://www.zoll.com/en-gb/products/accessories/by-product/aed-plus' },
    { device: 'DDU-100', part: 'DDP-100', source: 'https://www.defibtech.com/products/lifeline-aed/' },
    { device: 'DDU-2300', part: 'DDP-2001', source: 'https://www.defibtech.com/products/lifeline-view-aed/' }
  ]);
  function binding(product, registry = bindings) {
    const entry = product && registry[product.id];
    return entry && entry.name === product.name ? entry : null;
  }
  function sheetApi() {
    if (typeof require === 'function') {
      try { return require('./lib/aed-sheet-compatibility'); } catch (error) { return null; }
    }
    return typeof AedSheetCompatibility !== 'undefined' ? AedSheetCompatibility : null;
  }
  function compatible(aed, accessory, registry = bindings) {
    const device = binding(aed, registry), part = binding(accessory, registry);
    const reviewed = !!(device && part && (part.kind === 'universal' && Array.isArray(part.devices) && part.devices.includes(device.model) || relationships.some(item => item.device === device.model && item.part === part.model)));
    if (reviewed) return true;
    if (registry !== bindings) return false;
    const sheet = sheetApi();
    return !!(sheet && sheet.sheetCompatible(aed, accessory));
  }
  function partNumber(product) {
    const entry = binding(product);
    if (entry && entry.kind) return entry.model;
    return product && product.part_number ? String(product.part_number) : '';
  }
  function accessoryKind(product) { const entry = binding(product); return entry && entry.kind || ''; }
  function exclusiveGroup(product) {
    if (product && product.exclusive_group) return product.exclusive_group;
    const sheet = sheetApi();
    return sheet ? sheet.exclusiveGroup(product) : '';
  }
  const accessoryWords = /\b(pads?|electrodes?|batter(?:y|ies)|cabinets?|brackets?|signs?|cases?|kits?|accessor(?:y|ies))\b/i;
  const nonDeviceWords = /\b(trainers?|training|deposit|program|service|orientation)\b/i;
  function build(products) {
    const aeds = [], accessories = [];
    for (const product of products) {
      if (!product || product.enabled === false || !product.id) continue;
      if (product.catalogue === 'prestan' || product.catalogue === 'sos') continue;
      const sheetDevice = product.category_id === 'aed-devices';
      if (!sheetDevice && !/\baed\b/i.test(String(product.category || ''))) continue;
      const text = `${product.category || ''} ${product.name || ''}`;
      const isAccessory = !sheetDevice && accessoryWords.test(text);
      if (!isAccessory && !sheetDevice && (nonDeviceWords.test(text) || !/\baed\b/i.test(String(product.name || '')))) continue;
      const amount = Number(product.amount);
      const price = product.price_verified === true && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
      const item = { id: product.id, name: product.name || '', description: product.description || '', image: product.image || '', mode: product.mode, price, type: isAccessory ? 'accessory' : 'aed', part_number: partNumber(product), exclusive_group: isAccessory ? exclusiveGroup(product) : '' };
      (isAccessory ? accessories : aeds).push(item);
    }
    return { source: 'catalog', aeds, accessories };
  }
  function quantity(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 99 ? number : 1;
  }
  function summary(items) {
    return { knownSubtotal: items.reduce((total, item) => total + (item.price == null ? 0 : item.price * item.quantity), 0), needsQuote: !items.length || items.some(item => item.price == null) };
  }
  return { build, quantity, summary, compatible, partNumber, accessoryKind, exclusiveGroup, relationships };
})();
if (typeof module !== 'undefined') module.exports = AedCatalog;
