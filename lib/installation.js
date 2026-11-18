const rules = require('../config/installation');

function normalizeProvince(value) {
  const text = String(value || '').trim().toLowerCase().replace(/\./g, '');
  if (text === 'on' || text === 'ontario') return 'ON';
  return String(value || '').trim().toUpperCase();
}

function normalizePostal(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function matchingRegion(address) {
  if (!address) return null;
  const country = String(address.country || 'CA').trim().toUpperCase();
  const province = normalizeProvince(address.province);
  const postal = normalizePostal(address.postal || address.postalCode);
  return (rules.regions || []).find((region) => {
    if (country !== String(region.country || 'CA').toUpperCase()) return false;
    if (province !== String(region.province || '').toUpperCase()) return false;
    return (region.postalPrefixes || []).some((prefix) => postal.startsWith(String(prefix || '').toUpperCase()));
  }) || null;
}

function offerIfConfigured(offer, group) {
  if (!offer || offer.enabled !== true) return null;
  if (offer.priceCents === null || offer.priceCents === undefined || !Number.isInteger(Number(offer.priceCents)) || Number(offer.priceCents) < 0) return null;
  return {
    available: true,
    group,
    priceCents: Number(offer.priceCents),
    label: offer.label,
    description: offer.description || '',
    currency: 'cad'
  };
}

function quoteInstallation(products, address) {
  const unavailable = { available: false, priceCents: null, label: '', description: '', currency: 'cad', group: '' };
  if (!matchingRegion(address)) return unavailable;
  const list = products || [];
  if (list.some((product) => product.installation_group === 'aed')) {
    return offerIfConfigured(rules.offers.aed, 'aed') || unavailable;
  }
  if (list.some((product) => product.installation_group === 'first_aid_kit')) {
    return offerIfConfigured(rules.offers.first_aid_kit, 'first_aid_kit') || unavailable;
  }
  return unavailable;
}

function publicInstallationConfig() {
  const aed = rules.offers.aed;
  const kit = rules.offers.first_aid_kit;
  return {
    regions: rules.regions,
    aed: {
      enabled: Boolean(aed && aed.enabled && aed.priceCents !== null && aed.priceCents !== undefined),
      priceCents: aed && Number.isInteger(aed.priceCents) ? aed.priceCents : null,
      label: aed ? aed.label : '',
      description: aed ? aed.description : ''
    },
    firstAidKit: {
      enabled: Boolean(kit && kit.enabled && kit.priceCents !== null && kit.priceCents !== undefined)
    }
  };
}

module.exports = { quoteInstallation, matchingRegion, normalizePostal, normalizeProvince, publicInstallationConfig };
