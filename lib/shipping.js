const config = require('../config/shipping');

function applies(rule, items) {
  const target = rule.appliesTo;
  if (!target) return true;
  return items.some((item) => {
    return Object.entries(target).every(([key, value]) => {
      if (key === 'shippingClass') return item.shipping && item.shipping.shippingClass === value;
      return item[key] === value;
    });
  });
}

function quoteShipping(items, destination) {
  const goods = (items || []).filter((item) => item && item.catalogue && item.shippable !== false);
  if (!goods.length) {
    return { status: 'not_required', amountCents: 0, currency: config.currency, strategy: 'none', placeholder: false, label: '', note: '' };
  }
  const country = String((destination && destination.country) || config.country || 'CA').trim().toUpperCase();
  if (country !== 'CA') {
    return {
      status: 'unavailable',
      amountCents: 0,
      currency: config.currency,
      strategy: 'none',
      placeholder: false,
      label: 'Canada only',
      note: 'Orders ship within Canada only.'
    };
  }

  const active = (config.rules || []).filter((rule) => rule.active && applies(rule, goods));
  const quoteRule = active.find((rule) => rule.customerPays === 'quote' || rule.customerPays === 'weight_size');
  if (quoteRule) {
    return {
      status: 'quote_required',
      amountCents: 0,
      currency: config.currency,
      strategy: quoteRule.customerPays,
      placeholder: false,
      label: quoteRule.label,
      note: quoteRule.customerPays === 'weight_size'
        ? 'Weight and size are stored on the product, but no rate card is configured. Request a shipping quote.'
        : quoteRule.description
    };
  }

  const perItem = active.find((rule) => rule.customerPays === 'per_item');
  if (perItem) {
    const amountCents = goods.reduce((sum, item) => {
      const each = Number(item.shipping && item.shipping.perItemCents);
      const rate = Number.isInteger(each) ? each : Number(perItem.amountCents) || 0;
      return sum + rate * (Number(item.quantity) || 1);
    }, 0);
    return {
      status: 'priced',
      amountCents,
      currency: config.currency,
      strategy: 'per_item',
      placeholder: false,
      label: perItem.label,
      note: perItem.description
    };
  }

  const flat = active.find((rule) => rule.customerPays === 'flat_per_order');
  if (flat) {
    return {
      status: 'priced',
      amountCents: Number(flat.amountCents) || 0,
      currency: config.currency,
      strategy: 'flat_per_order',
      placeholder: Boolean(flat.placeholder),
      label: flat.label,
      note: flat.description
    };
  }

  const free = active.find((rule) => rule.customerPays === 'free');
  if (free) {
    return {
      status: 'priced',
      amountCents: 0,
      currency: config.currency,
      strategy: 'free',
      placeholder: false,
      label: free.label,
      note: free.description || 'Shipping is included. The business absorbs the carrier cost.',
      absorbedByBusiness: true
    };
  }

  return {
    status: 'quote_required',
    amountCents: 0,
    currency: config.currency,
    strategy: 'none',
    placeholder: false,
    label: 'Shipping quote required',
    note: 'No active shipping rule matched this order.'
  };
}

module.exports = { quoteShipping };
