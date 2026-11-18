/**
 * Shipping rules for catalogue orders.
 *
 * The owner has not chosen a shipping model. Research is still underway.
 * Do not treat the active rule as final.
 *
 * Each rule can apply to a product or a category and use one of these
 * customerPays values:
 * - free: the customer is not charged. The business absorbs the carrier cost.
 * - flat_per_order: one amount for the whole order.
 * - per_item: an amount times quantity, from the rule or from product.shipping.perItemCents.
 * - weight_size: uses product.shipping weight and dimensions (Prestan records include both).
 *   No rate card is configured, so activating this asks for a shipping quote instead of inventing a price.
 * - quote: large or unusual items skip instant checkout and request a shipping quote.
 *
 * Only rules with active: true are used. The placeholder below is the only active rule.
 * Switch rules by editing this file. Checkout reads it on the server.
 */

module.exports = {
  country: 'CA',
  currency: 'cad',
  rules: [
    {
      id: 'placeholder-flat-per-order',
      active: true,
      placeholder: true,
      customerPays: 'flat_per_order',
      amountCents: 1999,
      label: 'Canada shipping (placeholder flat rate)',
      description: 'PLACEHOLDER, not a final rate. Flat $19.99 CAD per order, which is SOS\'s current starting shipping charge. Shipping and tax are added at checkout. Tax calculation is not configured yet.'
    },
    {
      id: 'example-aed-free-to-customer',
      active: false,
      appliesTo: { installation_group: 'aed' },
      customerPays: 'free',
      absorbedByBusiness: true,
      label: 'AED shipping included',
      description: 'Example only. Free shipping to the customer, with the carrier cost absorbed by the business.'
    },
    {
      id: 'example-per-item',
      active: false,
      appliesTo: { category_id: 'prestan-parts' },
      customerPays: 'per_item',
      amountCents: 0,
      label: 'Per-item shipping',
      description: 'Example only. Set amountCents, or set product.shipping.perItemCents, before activating.'
    },
    {
      id: 'example-prestan-weight-size',
      active: false,
      appliesTo: { catalogue: 'prestan' },
      customerPays: 'weight_size',
      label: 'Weight and size shipping',
      description: 'Example only. Uses the weight and dimensions stored on the product. No rate card is configured, so checkout asks for a shipping quote.'
    },
    {
      id: 'example-large-item-quote',
      active: false,
      appliesTo: { shippingClass: 'bulky' },
      customerPays: 'quote',
      label: 'Shipping quote required',
      description: 'Example only. Set product.shipping.shippingClass to "bulky" and activate this rule to block instant checkout.'
    }
  ]
};
