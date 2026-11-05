const AedCatalog = (() => {
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
      const price = product.mode === 'buy_now' && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
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
  return { build, quantity, summary };
})();
if (typeof module !== 'undefined') module.exports = AedCatalog;
