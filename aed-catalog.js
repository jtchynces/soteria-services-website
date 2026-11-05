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
  function compatible(aed, accessory, registry = bindings) {
    const device = binding(aed, registry), part = binding(accessory, registry);
    return !!(device && part && (part.kind === 'universal' && Array.isArray(part.devices) && part.devices.includes(device.model) || relationships.some(item => item.device === device.model && item.part === part.model)));
  }
  function partNumber(product) { const entry = binding(product); return entry && entry.kind ? entry.model : ''; }
  function accessoryKind(product) { const entry = binding(product); return entry && entry.kind || ''; }
  const accessoryWords = /\b(pads?|electrodes?|batter(?:y|ies)|cabinets?|brackets?|signs?|cases?|kits?|accessor(?:y|ies))\b/i;
  const nonDeviceWords = /\b(trainers?|training|deposit|program|service|orientation)\b/i;
  function build(products) {
    const aeds = [], accessories = [];
    for (const product of products) {
      if (!product || product.enabled === false || !product.id || !/\baed\b/i.test(String(product.category || ''))) continue;
      const text = `${product.category || ''} ${product.name || ''}`;
      const isAccessory = accessoryWords.test(text);
      if (!isAccessory && (nonDeviceWords.test(text) || !/\baed\b/i.test(String(product.name || '')))) continue;
      const amount = Number(product.amount);
      const price = product.price_verified === true && product.mode === 'buy_now' && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
      const item = { id: product.id, name: product.name || '', description: product.description || '', image: product.image || '', mode: product.mode, price, type: isAccessory ? 'accessory' : 'aed' };
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
  return { build, quantity, summary, compatible, partNumber, accessoryKind, relationships };
})();
if (typeof module !== 'undefined') module.exports = AedCatalog;
