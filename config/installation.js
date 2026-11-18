/**
 * Optional installation at checkout.
 *
 * Eligibility is a list of country + province + postal-code prefixes.
 * The default is Southwestern Ontario: province ON and a postal code starting with N.
 * AED installation is free. First aid kit installation is off until the owner turns it on
 * and sets a price. A missing price (null) is not offered, even if enabled.
 */

module.exports = {
  regions: [
    {
      id: 'southwestern-ontario',
      country: 'CA',
      province: 'ON',
      postalPrefixes: ['N']
    }
  ],
  offers: {
    aed: {
      enabled: true,
      priceCents: 0,
      label: 'Free installation',
      description: 'Optional installation for AED orders shipping within Southwestern Ontario. AED pad serial numbers are recorded on site at installation.'
    },
    first_aid_kit: {
      enabled: false,
      priceCents: null,
      label: 'First aid kit installation',
      description: ''
    }
  }
};
